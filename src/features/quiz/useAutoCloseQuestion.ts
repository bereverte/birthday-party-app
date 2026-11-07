import { useEffect, useRef } from 'react'
import type { PartyState } from '../../hooks/usePartyState'
import { parseServerTime, serverNow } from '../../lib/serverClock'
import { supabase } from '../../lib/supabase'

const RETRY_MS = 1000
const MAX_TRIES = 10

// When the time is up, every phone asks the server to close the question
// (DECISIONS 030). The FOR UPDATE lock lets one call do the work; the rest
// return at once. "Too early" (false) or a network error just means: try
// again in a second, silently. The loop stops when the question stops being
// 'open' (the effect is cleaned up) or after MAX_TRIES.
export function useAutoCloseQuestion(party: PartyState | undefined, onClosed: () => void) {
  const open = party?.question_status === 'open'
  const questionId = party?.current_question_id ?? null
  const closesAt = party?.question_closes_at ?? null

  // Latest callback without restarting the timer on every render.
  const onClosedRef = useRef(onClosed)
  useEffect(() => {
    onClosedRef.current = onClosed
  })

  useEffect(() => {
    if (!open || !questionId || !closesAt) return

    let cancelled = false
    let tries = 0
    let timer: ReturnType<typeof setTimeout>

    async function attempt() {
      if (cancelled) return
      tries++
      const { data, error } = await supabase.rpc('close_question')
      if (cancelled) return
      if (!error && data) {
        // Don't wait for the Realtime event: read the new state now.
        onClosedRef.current()
        return
      }
      if (tries < MAX_TRIES) timer = setTimeout(() => void attempt(), RETRY_MS)
    }

    const delay = Math.max(0, parseServerTime(closesAt) - serverNow())
    timer = setTimeout(() => void attempt(), delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, questionId, closesAt])
}
