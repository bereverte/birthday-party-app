import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TextInput } from '../../components/ui/TextInput'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Challenge } from './useChallenges'

type Props = {
  // null = new challenge, added at the end.
  challenge: Challenge | null
  nextPosition: number
  onDone: () => void
}

// Create or edit a challenge. The database checks the lengths too.
export function ChallengeForm({ challenge, nextPosition, onDone }: Props) {
  const [name, setName] = useState(challenge?.name ?? '')
  const [description, setDescription] = useState(challenge?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    // No emoji field: the column keeps its database default and the UI no longer shows it.
    const values = {
      name: name.trim(),
      description: description.trim() || null,
    }
    const { error: saveError } = challenge
      ? await supabase.from('challenges').update(values).eq('id', challenge.id)
      : await supabase.from('challenges').insert({ ...values, position: nextPosition })
    setSaving(false)
    if (saveError) setError(friendlyError(saveError))
    else onDone()
  }

  return (
    <Card tone="sun">
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <h3 className="text-xl font-bold">{challenge ? 'Editar prova' : 'Nova prova'}</h3>
        <TextInput
          label="Nom"
          value={name}
          maxLength={40}
          required
          placeholder="🪢 Saltar a corda"
          hint="Si vols un emoji, posa’l al nom."
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="Descripció (opcional)"
          value={description}
          maxLength={200}
          placeholder="Qui fa més salts seguits."
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && (
          <p role="alert" className="font-semibold text-tomato">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Desar
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel·lar
          </Button>
        </div>
      </form>
    </Card>
  )
}
