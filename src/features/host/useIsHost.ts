import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Result = { userId: string; isHost: boolean }

// Asks the database, the same check RLS and the RPCs use (is_host()).
// The UI only uses it to pick a screen; the database enforces it anyway.
export function useIsHost(userId: string | null) {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase.rpc('is_host').then(({ data, error }) => {
      if (cancelled) return
      setError(error)
      if (!error) setResult({ userId, isHost: data })
    })
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  // A result for a previous user (e.g. after signing in) doesn't count.
  const isHost = result && result.userId === userId ? result.isHost : null
  return { isHost, error, recheck: () => setAttempt((n) => n + 1) }
}
