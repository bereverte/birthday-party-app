import { useEffect } from 'react'
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'

type Options<T> = Omit<Parameters<typeof useRealtimeRefetch<T>>[0], 'fetcher'> & {
  // What the data depends on (e.g. the current question id). null = nothing to read.
  key: string | null
  fetcher: (key: string) => Promise<T>
  // When a result for an older key is still good enough to show while the
  // new one loads (default: only for the exact same key).
  sameData?: (dataKey: string, key: string) => boolean
}

// useRealtimeRefetch for data that depends on a prop. Two extra things:
// - it refetches when the key changes (a new question doesn't always come
//   with an event on the tables this hook listens to);
// - it hides a result fetched for a previous key, so the screen never shows
//   the last question's answer for a moment.
export function useKeyedRefetch<T>({
  key,
  fetcher,
  enabled = true,
  sameData = (a, b) => a === b,
  ...options
}: Options<T>) {
  const result = useRealtimeRefetch({
    ...options,
    enabled: enabled && key !== null,
    fetcher: async () => ({ key, value: key === null ? null : await fetcher(key) }),
  })
  const { refetch } = result

  useEffect(() => {
    if (enabled && key !== null) void refetch()
  }, [enabled, key, refetch])

  const dataKey = result.data?.key ?? null
  const fresh = dataKey !== null && key !== null && sameData(dataKey, key) ? result.data!.value : null
  return { ...result, data: fresh ?? undefined }
}
