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

  // A stored session can outlive its user (deleted by hand, or a local
  // `db reset`): the token still looks valid, but every write fails. Ask the
  // Auth server once; if the user is gone, drop the session locally and the
  // effect below signs in again. Network errors keep the session.
  const verified = useRef<string | null>(null)
  useEffect(() => {
    if (!user || verified.current === user.id) return
    verified.current = user.id
    void supabase.auth.getUser().then(({ error }) => {
      if (error && (error.code === 'user_not_found' || error.code === 'session_not_found')) {
        void supabase.auth.signOut({ scope: 'local' })
      }
    })
  }, [user])

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
