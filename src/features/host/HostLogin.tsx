import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { TextInput } from '../../components/ui/TextInput'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// Magic link: no password to remember, and the session then lasts on that
// device. The link brings her back to /host (allowed in config.toml).
export function HostLogin() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/host` },
    })
    setSending(false)
    if (error) setError(friendlyError(error))
    else setSentTo(email.trim())
  }

  return (
    <Screen>
      <header className="flex flex-col items-center gap-3 pt-6 text-center">
        <span className="text-4xl" aria-hidden>
          👑
        </span>
        <h1 className="text-3xl leading-none font-bold">Zona de l’amfitriona</h1>
        <p className="text-ink-soft">T’enviarem un enllaç per entrar sense contrasenya.</p>
      </header>

      {sentTo ? (
        <Card tone="mint" className="flex flex-col gap-2 text-center">
          <span className="text-4xl" aria-hidden>
            💌
          </span>
          <p className="font-display text-xl font-bold">Mira el correu!</p>
          <p>
            Hem enviat l’enllaç a <strong className="break-all">{sentTo}</strong>. Obre’l en este mateix dispositiu.
          </p>
          {import.meta.env.DEV && (
            <p className="text-sm">
              En local arriba a{' '}
              <a className="font-bold underline" href="http://127.0.0.1:54324" target="_blank" rel="noreferrer">
                Mailpit
              </a>
              .
            </p>
          )}
          <Button variant="ghost" onClick={() => setSentTo(null)} className="mt-2">
            Canviar el correu
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <TextInput
            label="Correu"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="tu@exemple.com"
            required
          />
          {error && (
            <p role="alert" className="rounded-2xl bg-tomato/15 px-4 py-3 font-semibold">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={sending} disabled={!email.trim()}>
            Envia’m l’enllaç ✨
          </Button>
        </form>
      )}
    </Screen>
  )
}
