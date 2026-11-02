import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// Reuses the session stored in this browser, or signs in anonymously
// (DECISIONS 021). Reopening the tab finds the stored session, so it is the
// same auth.uid() and the same players row, and no new sign-in is spent
// against the rate limit.
export function useGuestSession() {
  const { user, loading } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  // Refs survive StrictMode's double effect, so we never create two users.
  const attempted = useRef(false)

  const signIn = useCallback(async () => {
    setSigningIn(true)
    setError(null)
    const { error } = await supabase.auth.signInAnonymously()
    if (error) setError(friendlyError(error))
    setSigningIn(false)
  }, [])

  useEffect(() => {
    if (loading) return
    if (user) {
      attempted.current = false
      return
    }
    if (attempted.current) return
    attempted.current = true
    void signIn()
  }, [loading, user, signIn])

  return { user, error, signingIn, retry: signIn }
}
