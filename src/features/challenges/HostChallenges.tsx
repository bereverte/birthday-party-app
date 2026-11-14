import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Ranking } from '../leaderboard/Ranking'
import { useLeaderboard } from '../leaderboard/useLeaderboard'
import { ChallengeForm } from './ChallengeForm'
import { useChallengePoints } from './useChallengePoints'
import { useChallengePresets } from './useChallengePresets'
import { useChallenges, type Challenge } from './useChallenges'

type Props = {
  party: PartyState
  players: Player[]
  refetchParty: () => void
}

const presetLabels = ['🥇', '🥈', '🥉', '🙌']
const statusLabels: Record<string, string> = { pending: 'Pendent', active: 'Ara', done: 'Feta' }

// The host's challenge controls: manage the list, start one, then select
// players (one, or a whole team) and tap the points (DECISIONS 008, 033).
// Re-awarding overwrites, so a wrong tap is fixed by tapping again.
export function HostChallenges({ party, players, refetchParty }: Props) {
  const challenges = useChallenges()
  const presets = useChallengePresets()
  const ranking = useLeaderboard()
  const currentId = party.current_challenge_id
  const points = useChallengePoints(currentId)

  // The selection belongs to one challenge: starting another one clears it.
  const [selection, setSelection] = useState<{ challengeId: string | null; ids: string[] }>({
    challengeId: null,
    ids: [],
  })
  const selected = selection.challengeId === currentId ? selection.ids : []
  const [custom, setCustom] = useState('')
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key)
    setNotice(null)
    try {
      const message = await action()
      if (message) setNotice(message)
    } catch (err) {
      setNotice(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string) =>
    setSelection({
      challengeId: currentId,
      ids: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    })
  const clearSelection = () => setSelection({ challengeId: currentId, ids: [] })

  const start = (id: string) =>
    run(`start:${id}`, async () => {
      const { error } = await supabase.rpc('start_challenge', { p_challenge_id: id })
      refetchParty()
      if (error) throw error
    })

  const finish = () =>
    run('finish', async () => {
      const { error } = await supabase.rpc('finish_challenge')
      refetchParty()
      if (error) throw error
    })

  const award = (value: number) =>
    run(`award:${value}`, async () => {
      if (!currentId) return
      const { data, error } = await supabase.rpc('award_challenge_points', {
        p_challenge_id: currentId,
        p_player_ids: selected,
        p_points: value,
      })
      if (error) throw error
      clearSelection()
      setCustom('')
      void points.refetch()
      return `+${value} punts a ${data} ${data === 1 ? 'jugador' : 'jugadors'} ✓`
    })

  const removePoints = () =>
    run('remove', async () => {
      if (!currentId) return
      const { error } = await supabase
        .from('points_ledger')
        .delete()
        .eq('source_type', 'challenge')
        .eq('source_id', currentId)
        .in('player_id', selected)
      if (error) throw error
      clearSelection()
      void points.refetch()
      return 'Punts trets ✓'
    })

  const remove = (challenge: Challenge) => {
    if (!window.confirm(`Esborrar ${challenge.name}?`)) return
    return run(`delete:${challenge.id}`, async () => {
      // RLS turns a refused delete into "0 rows", not an error.
      const { data, error } = await supabase.from('challenges').delete().eq('id', challenge.id).select('id')
      if (error) throw error
      if (data.length === 0) return `${challenge.name} ja té punts. Treu-los abans d’esborrar-la.`
    })
  }

  if (!challenges.data) {
    return (
      <Card>
        <p className="font-bold">{challenges.error ? friendlyError(challenges.error) : 'Carregant proves…'}</p>
      </Card>
    )
  }

  const list = challenges.data
  const current = list.find((c) => c.id === currentId) ?? null
  const next = list.find((c) => c.status === 'pending') ?? null
  const nextPosition = Math.max(0, ...list.map((c) => c.position)) + 1
  const customValue = Number.parseInt(custom, 10)

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p role="status" className="animate-pop rounded-2xl bg-sun-soft px-4 py-3 font-semibold shadow-card">
          {notice}
        </p>
      )}

      {current ? (
        <Card tone="party" className="flex flex-col gap-3">
          <p className="text-sm font-bold opacity-85">Prova en marxa</p>
          <div className="min-w-0">
            <h2 className="text-2xl leading-tight font-bold break-words">{current.name}</h2>
            {current.description && <p className="mt-1 break-words">{current.description}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" loading={busy === 'finish'} onClick={() => void finish()}>
              ✅ Acabar prova
            </Button>
            {next && (
              <Button variant="ghost" loading={busy === `start:${next.id}`} onClick={() => void start(next.id)}>
                ▶️ Següent: {next.name}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card tone="party" className="flex flex-col items-start gap-3">
          <h2 className="text-2xl font-bold">🏃 Proves</h2>
          {next ? (
            <Button variant="primary" size="lg" loading={busy === `start:${next.id}`} onClick={() => void start(next.id)}>
              ▶️ Començar {next.name}
            </Button>
          ) : (
            <p>{list.length === 0 ? 'Encara no hi ha proves. Crea’n una aquí baix.' : 'Totes les proves estan fetes 🎉'}</p>
          )}
        </Card>
      )}

      {current && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Puntuar</h2>
            <p className="text-sm text-ink-soft">Toca qui ha guanyat (o tot l’equip)</p>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((player) => {
              const isSelected = selected.includes(player.id)
              const score = points.data?.get(player.id)
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(player.id)}
                    className={`flex w-full items-center gap-2 rounded-2xl p-2 text-left transition-colors ${isSelected ? 'bg-pink-soft ring-2 ring-pink' : 'bg-bg-via'}`}
                  >
                    <EmojiAvatar emoji={player.emoji} seed={player.id} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {player.isHost && '👑 '}
                      {player.name}
                    </span>
                    {score !== undefined && (
                      <span className="rounded-full bg-mint-soft px-2 py-0.5 text-sm font-bold tabular-nums">
                        {score}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Sticky so it stays reachable under a long list of players on a phone. */}
          <div className="sticky bottom-3 flex flex-col gap-3 rounded-3xl bg-paper p-3 shadow-lift">
            <p className="text-sm font-bold">
              {selected.length === 0
                ? 'Cap jugador seleccionat'
                : `${selected.length} ${selected.length === 1 ? 'seleccionat' : 'seleccionats'}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {(presets.data ?? []).map((value, i) => (
                <Button
                  key={value}
                  variant="secondary"
                  disabled={selected.length === 0 || (busy !== null && busy !== `award:${value}`)}
                  loading={busy === `award:${value}`}
                  onClick={() => void award(value)}
                >
                  {presetLabels[i] ?? '⭐'} {value}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label="Punts personalitzats"
                placeholder="Altres"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="w-24 rounded-full border border-line bg-paper px-4 py-2 outline-none focus:border-pink"
              />
              <Button
                variant="ghost"
                disabled={selected.length === 0 || !(customValue >= 0) || busy !== null}
                loading={busy === `award:${customValue}`}
                onClick={() => void award(customValue)}
              >
                Donar
              </Button>
              <Button
                variant="ghost"
                disabled={selected.length === 0 || busy !== null}
                loading={busy === 'remove'}
                onClick={() => void removePoints()}
              >
                Treure punts
              </Button>
              {selected.length > 0 && (
                <Button variant="ghost" onClick={clearSelection}>
                  Netejar
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* grid-cols-1 = minmax(0, 1fr): long truncated names can't push the column wider than the screen. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Llista de proves</h2>
            {editing === null && (
              <Button variant="ghost" className="px-3! py-1.5! text-sm" onClick={() => setEditing('new')}>
                + Nova
              </Button>
            )}
          </div>
          {editing !== null && (
            <ChallengeForm
              key={editing === 'new' ? 'new' : editing.id}
              challenge={editing === 'new' ? null : editing}
              nextPosition={nextPosition}
              onDone={() => {
                setEditing(null)
                void challenges.refetch()
              }}
            />
          )}
          {list.length === 0 ? (
            <p className="text-ink-soft">Cap prova encara.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2">
                  <span className={`min-w-0 flex-1 truncate ${c.id === currentId ? 'font-bold' : ''}`}>{c.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.status === 'active' ? 'bg-pink-soft' : c.status === 'done' ? 'bg-mint-soft' : 'bg-bg-via'}`}
                  >
                    {statusLabels[c.status] ?? c.status}
                  </span>
                  {c.id !== currentId && (
                    <Button
                      variant="ghost"
                      className="px-2.5! py-1! text-sm"
                      disabled={busy !== null}
                      loading={busy === `start:${c.id}`}
                      onClick={() => void start(c.id)}
                      aria-label={`Començar ${c.name}`}
                    >
                      ▶️
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="px-2.5! py-1! text-sm"
                    onClick={() => setEditing(c)}
                    aria-label={`Editar ${c.name}`}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2.5! py-1! text-sm"
                    disabled={busy !== null}
                    loading={busy === `delete:${c.id}`}
                    onClick={() => void remove(c)}
                    aria-label={`Esborrar ${c.name}`}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <section className="mt-4 flex flex-col gap-3">
          <h2 className="text-xl font-bold">Rànquing general</h2>
          {ranking.data ? (
            <Ranking ranks={ranking.data} limit={10} />
          ) : (
            <p className="text-ink-soft">{ranking.error ? friendlyError(ranking.error) : 'Carregant…'}</p>
          )}
        </section>
      </div>
    </div>
  )
}
