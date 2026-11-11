import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Ranking } from '../leaderboard/Ranking'
import { usePartyLeaderboard } from '../leaderboard/usePartyLeaderboard'
import { ActMembers } from './ActMembers'
import { actKind } from './actKind'
import { actStatusLabels, actStatusTones } from './actStatus'
import { SignUpForm } from './SignUpForm'
import { StarPicker } from './StarPicker'
import { useActResult } from './useActResult'
import { useActVotes } from './useActVotes'
import { useShowActs, type ShowAct } from './useShowActs'

type Props = {
  me: Player
  party: PartyState
  players: Player[]
  refetchParty: () => void
}

// The host's show controls: one act at a time, ▶️ start → 🗳️ open voting →
// ✅ close (scores it). She votes too, and can sign up her own act
// (DECISIONS 034).
export function HostShow({ me, party, players, refetchParty }: Props) {
  const acts = useShowActs()
  const ranking = usePartyLeaderboard()
  const currentId = party.current_act_id
  // The host sees every vote (RLS), so this is the live count.
  const votes = useActVotes(currentId)
  const result = useActResult(currentId)
  const [adding, setAdding] = useState(false)
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

  const start = (id: string) =>
    run(`start:${id}`, async () => {
      const { error } = await supabase.rpc('start_act', { p_act_id: id })
      refetchParty()
      void acts.refetch()
      if (error) throw error
    })

  const openVoting = () =>
    run('open', async () => {
      const { error } = await supabase.rpc('open_voting')
      void acts.refetch()
      if (error) throw error
    })

  const closeVoting = (id: string) =>
    run('close', async () => {
      const { error } = await supabase.rpc('close_voting', { p_act_id: id })
      void acts.refetch()
      void result.refetch()
      if (error) throw error
    })

  const vote = (id: string, score: number) =>
    run('vote', async () => {
      const { error } = await supabase.rpc('cast_vote', { p_act_id: id, p_score: score })
      if (error) throw error
      void votes.refetch()
    })

  const remove = (act: ShowAct) => {
    if (!window.confirm(`Esborrar «${act.title}»?`)) return
    return run(`delete:${act.id}`, async () => {
      if (act.status === 'pending') {
        const { error } = await supabase.rpc('withdraw_act', { p_act_id: act.id })
        if (error) throw error
      } else {
        // RLS turns a refused delete into "0 rows", not an error.
        const { data, error } = await supabase.from('show_acts').delete().eq('id', act.id).select('id')
        if (error) throw error
        if (data.length === 0) return `«${act.title}» ja té punts. Treu-los abans d’esborrar-la.`
      }
      void acts.refetch()
    })
  }

  if (!acts.data) {
    return (
      <Card>
        <p className="font-bold">{acts.error ? friendlyError(acts.error) : 'Carregant el show…'}</p>
      </Card>
    )
  }

  const list = acts.data
  const current = list.find((a) => a.id === currentId) ?? null
  const onStage = current && current.status !== 'pending' ? current : null
  const next = list.find((a) => a.status === 'pending') ?? null
  const voters = onStage ? players.filter((p) => !onStage.memberIds.includes(p.id)).length : 0
  const myVote = votes.data?.byVoter.get(me.id) ?? null

  const startNext = next && (
    <Button
      variant={onStage ? 'ghost' : 'primary'}
      size={onStage ? 'md' : 'lg'}
      loading={busy === `start:${next.id}`}
      disabled={busy !== null}
      onClick={() => void start(next.id)}
    >
      ▶️ {onStage ? 'Següent' : 'Començar'}: {next.title}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p role="status" className="animate-pop rounded-2xl bg-sun-soft px-4 py-3 font-semibold shadow-card">
          {notice}
        </p>
      )}

      {onStage ? (
        <Card tone="party" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold opacity-85">
              {onStage.status === 'performing' && 'A l’escenari'}
              {onStage.status === 'voting' && 'Votació oberta'}
              {onStage.status === 'done' && 'Resultat'}
            </p>
            <p className="text-sm font-bold">{actKind(onStage.memberIds.length)}</p>
          </div>
          <h2 className="text-3xl leading-tight font-bold break-words">{onStage.title}</h2>
          <div className="self-start rounded-2xl bg-paper px-3 py-2 text-ink">
            <ActMembers memberIds={onStage.memberIds} players={players} />
          </div>

          {onStage.status !== 'performing' && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <dt className="text-sm opacity-85">Vots</dt>
                <dd className="font-display text-3xl font-bold tabular-nums">
                  {votes.data?.count ?? 0} / {voters}
                </dd>
              </div>
              {votes.data?.average != null && (
                <div>
                  <dt className="text-sm opacity-85">Mitjana</dt>
                  <dd className="font-display text-3xl font-bold tabular-nums">⭐ {votes.data.average.toFixed(1)}</dd>
                </div>
              )}
              {onStage.status === 'done' && result.data && (
                <div>
                  <dt className="text-sm opacity-85">Punts per artista</dt>
                  <dd className="font-display text-3xl font-bold tabular-nums">+{result.data.points}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="flex flex-wrap gap-3">
            {onStage.status === 'performing' && (
              <Button variant="primary" size="lg" loading={busy === 'open'} onClick={() => void openVoting()}>
                🗳️ Obrir votació
              </Button>
            )}
            {onStage.status === 'voting' && (
              <Button variant="primary" size="lg" loading={busy === 'close'} onClick={() => void closeVoting(onStage.id)}>
                ✅ Tancar votació
              </Button>
            )}
            {onStage.status !== 'voting' && startNext}
          </div>
        </Card>
      ) : (
        <Card tone="party" className="flex flex-col items-start gap-3">
          <h2 className="text-3xl font-bold">🎤 Show final</h2>
          {startNext ?? (
            <p>{list.length === 0 ? 'Encara no s’ha apuntat ningú.' : 'Totes les actuacions estan fetes 🎉'}</p>
          )}
        </Card>
      )}

      {onStage?.status === 'voting' && (
        <Card className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold">El teu vot</h2>
          {onStage.memberIds.includes(me.id) ? (
            <p className="text-ink-soft">No pots votar la teua actuació 🙈</p>
          ) : (
            <StarPicker value={myVote} onChange={(score) => void vote(onStage.id, score)} disabled={busy === 'vote'} />
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">Actuacions</h2>
            {!adding && (
              <Button variant="ghost" className="px-3! py-1.5! text-sm" onClick={() => setAdding(true)}>
                + La meua
              </Button>
            )}
          </div>
          {adding && (
            <SignUpForm
              me={me}
              players={players}
              onDone={() => {
                setAdding(false)
                void acts.refetch()
              }}
            />
          )}
          {list.length === 0 ? (
            <p className="text-ink-soft">Ningú encara. Els convidats s’apunten des del mòbil.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {list.map((act) => (
                <li key={act.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 break-words ${act.id === currentId ? 'font-bold' : ''}`}>
                      {act.title}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${actStatusTones[act.status]}`}>
                      {actStatusLabels[act.status] ?? act.status}
                    </span>
                    {act.id !== currentId && (
                      <Button
                        variant="ghost"
                        className="px-2.5! py-1! text-sm"
                        disabled={busy !== null}
                        loading={busy === `start:${act.id}`}
                        onClick={() => void start(act.id)}
                        aria-label={`Començar ${act.title}`}
                      >
                        ▶️
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="px-2.5! py-1! text-sm"
                      disabled={busy !== null || act.status === 'performing' || act.status === 'voting'}
                      loading={busy === `delete:${act.id}`}
                      onClick={() => void remove(act)}
                      aria-label={`Esborrar ${act.title}`}
                    >
                      ✕
                    </Button>
                  </div>
                  <ActMembers memberIds={act.memberIds} players={players} />
                </li>
              ))}
            </ol>
          )}
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Rànquing de la festa</h2>
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
