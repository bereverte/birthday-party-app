import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import { Screen } from '../../components/ui/Screen'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// A fixed set to tap instead of the emoji keyboard: faster on a phone and
// no odd values. 👑 is left out: it marks the host.
const EMOJIS = [
  '🎉', '🦄', '🐱', '🐶', '🦊', '🐼', '🐸', '🐙',
  '🦖', '🌵', '🍕', '🍩', '🌈', '⭐', '🔥', '👽',
  '🤖', '🎸', '🪩', '🧁', '🐝', '🦋', '🍉', '🐧',
]

type Props = {
  userId: string
  onJoined: () => void
  title?: string
}

export function JoinForm({ userId, onJoined, title = 'Entra a la festa!' }: Props) {
  const nameId = useId()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('join_party', { p_name: trimmed, p_emoji: emoji })
    setSaving(false)
    if (error) setError(friendlyError(error))
    else onJoined()
  }

  return (
    <Screen>
      <header className="flex flex-col items-center gap-3 pt-4 text-center">
        <span className="text-5xl" aria-hidden>
          🎂
        </span>
        <h1 className="text-4xl leading-none font-bold">{title}</h1>
        <p className="text-ink-soft">Digues com et diuen i tria el teu emoji.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* The name is typed straight into the preview card, next to the avatar. */}
        <Card className="flex items-center gap-4 transition-shadow focus-within:ring-2 focus-within:ring-pink/40">
          <EmojiAvatar key={emoji} emoji={emoji} seed={userId} size="lg" />
          <label htmlFor={nameId} className="sr-only">
            Nom
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete="nickname"
            enterKeyHint="done"
            placeholder="El teu nom"
            required
            className="min-w-0 flex-1 bg-transparent py-1 font-display text-2xl font-bold outline-none placeholder:text-ink-soft/50"
          />
        </Card>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-display font-bold">Emoji</legend>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map((option) => {
              const selected = option === emoji
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  aria-pressed={selected}
                  aria-label={option}
                  className={`aspect-square rounded-2xl text-2xl transition-transform duration-100 active:scale-90 ${
                    selected ? 'scale-105 bg-paper shadow-glow ring-2 ring-pink' : 'bg-paper/60'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-2xl bg-tomato/15 px-4 py-3 font-semibold">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={saving} disabled={!trimmed}>
          Entra a la festa 🎉
        </Button>
      </form>
    </Screen>
  )
}
