import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import { TextInput } from '../../components/ui/TextInput'
import type { Player } from '../../hooks/usePlayers'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { actKind } from './actKind'

type Props = {
  me: Player
  players: Player[]
  onDone: (created: boolean) => void
}

// Sign up an act: a title and, optionally, partners. sign_up_act always
// adds the caller as a member.
export function SignUpForm({ me, players, onDone }: Props) {
  const [title, setTitle] = useState('')
  const [partners, setPartners] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const others = players.filter((p) => p.id !== me.id)

  const toggle = (id: string) =>
    setPartners((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]))

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { error: saveError } = await supabase.rpc('sign_up_act', {
      p_title: title.trim(),
      p_member_ids: partners,
    })
    setSaving(false)
    if (saveError) setError(friendlyError(saveError))
    else onDone(true)
  }

  return (
    <Card tone="sun">
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xl font-bold">Nova actuació</h3>
          <span className="text-sm font-bold">{actKind(partners.length + 1)}</span>
        </div>
        <TextInput
          label="Què faràs?"
          value={title}
          maxLength={60}
          required
          placeholder="Un ball sorpresa"
          onChange={(e) => setTitle(e.target.value)}
        />
        {others.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-display font-bold">Amb qui? (opcional)</legend>
            <ul className="grid grid-cols-2 gap-2">
              {others.map((p) => {
                const on = partners.includes(p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(p.id)}
                      className={`flex w-full items-center gap-2 rounded-2xl p-2 text-left transition-colors ${on ? 'bg-pink-soft ring-2 ring-pink' : 'bg-paper'}`}
                    >
                      <EmojiAvatar emoji={p.emoji} seed={p.id} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {p.isHost && '👑 '}
                        {p.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="font-semibold text-tomato">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" loading={saving} disabled={!title.trim()}>
            Apuntar-me
          </Button>
          <Button type="button" variant="ghost" onClick={() => onDone(false)}>
            Cancel·lar
          </Button>
        </div>
      </form>
    </Card>
  )
}
