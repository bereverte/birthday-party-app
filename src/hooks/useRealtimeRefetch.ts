import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../lib/database.types'
import { onResync } from '../lib/partyChannel'
import { supabase } from '../lib/supabase'

// "Doorbell → refetch" (DECISIONS 001, 019). Realtime events carry no data
// we rely on: they only say "something changed", and we read the database
// again. We also read it whenever we might have missed an event:
// - the channel reaches SUBSCRIBED (first connection and every reconnection),
// - the tab becomes visible again (phones suspend locked tabs),
// - the browser comes back online,
// - the host sends "resync".
// So no client depends on having received every event.

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting'

type TableName = keyof Database['public']['Tables']

type Options<T> = {
  name: string
  tables: TableName[]
  fetcher: () => Promise<T>
  enabled?: boolean
}

// Unique topic per hook instance: supabase.channel() returns an existing
// channel with the same topic, and removal is async, so a React remount
// would otherwise get the channel that is being closed.
let channelCounter = 0

export function useRealtimeRefetch<T>({ name, tables, fetcher, enabled = true }: Options<T>) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  // Latest fetcher without resubscribing when the caller passes a new one.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  // Coalescing: one read at a time. A doorbell during a read marks the data
  // dirty, and one more read runs when it finishes. 30 events in a burst →
  // 2 reads, and an older response never overwrites a newer one.
  const inFlight = useRef(false)
  const dirty = useRef(false)
  // Bumped on cleanup so reads started for a previous subscription
  // (e.g. a different user) are discarded.
  const generation = useRef(0)

  const refetch = useCallback(async () => {
    if (inFlight.current) {
      dirty.current = true
      return
    }
    inFlight.current = true
    const gen = generation.current
    try {
      do {
        dirty.current = false
        try {
          const result = await fetcherRef.current()
          if (gen !== generation.current) return
          setData(result)
          setError(null)
        } catch (err) {
          if (gen !== generation.current) return
          setError(err)
        }
      } while (dirty.current)
    } finally {
      // A stale read must not release the lock of the current subscription.
      if (gen === generation.current) {
        inFlight.current = false
        setLoading(false)
      }
    }
  }, [])

  const tablesKey = tables.join(',')

  useEffect(() => {
    if (!enabled) return

    // First paint doesn't wait for the websocket.
    void refetch()

    const channel = supabase.channel(`db:${name}:${++channelCounter}`)
    for (const table of tablesKey.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => void refetch())
    }
    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        setStatus('live')
        void refetch()
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        // supabase-js retries on its own; SUBSCRIBED will follow.
        setStatus('reconnecting')
      }
    })

    function onVisible() {
      if (document.visibilityState === 'visible') void refetch()
    }
    function onOnline() {
      void refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const stopResync = onResync(() => void refetch())

    return () => {
      // A counter, not a DOM node: bumping its latest value is the point.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
      inFlight.current = false
      dirty.current = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      stopResync()
      void supabase.removeChannel(channel)
      setStatus('connecting')
    }
  }, [enabled, name, tablesKey, refetch])

  return { data, error, loading, status, refetch }
}
