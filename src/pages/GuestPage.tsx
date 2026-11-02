import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Temporary connection check: reuse the stored session or sign in anonymously.
// Replaced by the join flow in a later phase.
export default function GuestPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function ensureSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setUserId(data.session.user.id)
        return
      }
      const { data: signIn, error } = await supabase.auth.signInAnonymously()
      if (error) setError(error.message)
      else setUserId(signIn.user?.id ?? null)
    }
    ensureSession()
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-3xl font-bold">🎉 Guest</h1>
      {error && <p className="text-red-600">{error}</p>}
      {userId && <p className="font-mono text-sm break-all">user id: {userId}</p>}
      {!userId && !error && <p>Connecting…</p>}
    </main>
  )
}
