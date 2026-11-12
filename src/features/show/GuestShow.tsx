import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { PositionCard } from '../leaderboard/PositionCard'
import { useLeaderboard } from '../leaderboard/useLeaderboard'
import { ActMembers } from './ActMembers'
import { actKind } from './actKind'
import { StarPicker } from './StarPicker'
import { useActResult } from './useActResult'
import { useActVotes } from './useActVotes'
import { useShowActs, type ShowAct } from './useShowActs'

type Props = {
  me: Player
  players: Player[]
  party: PartyState
  status: RealtimeStatus
  onSignUp: () => void
}

// The guest's show screen, driven by the act on stage:
// none → line-up, performing → "on stage now", voting → stars, done → result.
export function GuestShow({ me, players, party, status, onSignUp }: Props) {
  const acts = useShowActs()
  const ranking = useLeaderboard()
  const current = acts.data?.find((a) => a.id === party.current_act_id) ?? null
  const onStage = current && current.status !== 'pending' ? current : null

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-bold">🎤 Show final</p>
        <StatusPill status={status} />
      </div>

      {!!acts.error && !acts.data && <p className="text-ink-soft">{friendlyError(acts.error)}</p>}

      {onStage?.status === 'performing' && <Performing act={onStage} players={players} />}
      {onStage?.status === 'voting' && <Voting act={onStage} me={me} />}
      {onStage?.status === 'done' && (
        <Result
          act={onStage}
          me={me}
          players={players}
          severalActs={(acts.data?.filter((a) => a.memberIds.includes(me.id)).length ?? 0) > 1}
        />
      )}
      {!onStage && acts.data && <LineUp acts={acts.data} players={players} />}

      {(!onStage || onStage.status === 'done') && (
        <Button variant="ghost" onClick={onSignUp}>
          🎤 Apunta’t o mira les teues actuacions
        </Button>
      )}

      {ranking.data && ranking.data.length > 0 && (!onStage || onStage.status === 'done') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Rànquing general</h2>
          <PositionCard ranks={ranking.data} meId={me.id} />
        </section>
      )}
    </Screen>
  )
}

function LineUp({ acts, players }: { acts: ShowAct[]; players: Player[] }) {
  const pending = acts.filter((a) => a.status === 'pending')
  return (
    <>
      <Card tone="party" className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="animate-float text-7xl" aria-hidden>
          🎤
        </span>
        <h1 className="text-4xl font-bold">El show comença aviat</h1>
        <p className="text-lg">Busca un bon lloc i prepara les estreles.</p>
      </Card>
      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Actuacions</h2>
          <Card className="flex flex-col divide-y divide-line py-2">
            {pending.map((act) => (
              <div key={act.id} className="flex flex-col gap-2 py-3">
                <p className="font-bold break-words">
                  <span className="text-sm text-ink-soft">{actKind(act.memberIds.length)} · </span>
                  {act.title}
                </p>
                <ActMembers memberIds={act.memberIds} players={players} />
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  )
}

function Performing({ act, players }: { act: ShowAct; players: Player[] }) {
  return (
    <Card tone="party" className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="font-bold opacity-85">Ara a l’escenari</p>
      <h1 className="text-4xl leading-tight font-bold break-words">{act.title}</h1>
      <div className="rounded-2xl bg-paper px-4 py-3 text-ink">
        <ActMembers memberIds={act.memberIds} players={players} size="md" />
      </div>
      <p className="text-lg">Gaudeix! La votació s’obri quan acaben 👏</p>
    </Card>
  )
}

function Voting({ act, me }: { act: ShowAct; me: Player }) {
  // RLS only returns my own vote.
  const votes = useActVotes(act.id)
  const saved = votes.data?.byVoter.get(me.id) ?? null
  // What I just tapped, until the refetch confirms it.
  const [picked, setPicked] = useState<{ actId: string; score: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMember = act.memberIds.includes(me.id)
  const value = picked?.actId === act.id ? picked.score : saved

  const vote = async (score: number) => {
    setPicked({ actId: act.id, score })
    setSending(true)
    setError(null)
    const { error: voteError } = await supabase.rpc('cast_vote', { p_act_id: act.id, p_score: score })
    setSending(false)
    if (voteError) {
      setPicked(null)
      setError(friendlyError(voteError))
    } else {
      void votes.refetch()
    }
  }

  return (
    <Card tone="party" className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="font-bold opacity-85">Votació oberta</p>
      <h1 className="text-4xl leading-tight font-bold break-words">{act.title}</h1>
      {isMember ? (
        <p className="text-xl font-bold">No pots votar la teua actuació 🙈 Ara voten els altres!</p>
      ) : (
        <>
          <div className="w-full rounded-3xl bg-paper px-2 py-4 text-ink">
            <StarPicker value={value} onChange={(score) => void vote(score)} disabled={sending} />
          </div>
          <p className="text-lg" role="status">
            {error ?? (saved !== null ? 'Vot enviat ✓ Pots canviar-lo fins que es tanque.' : 'Toca les estreles per votar.')}
          </p>
        </>
      )}
    </Card>
  )
}

function Result({
  act,
  me,
  players,
  severalActs,
}: {
  act: ShowAct
  me: Player
  players: Player[]
  severalActs: boolean
}) {
  const result = useActResult(act.id)
  const isMember = act.memberIds.includes(me.id)

  return (
    <Card tone="party" className="flex animate-pop flex-col items-center gap-3 py-8 text-center">
      <p className="font-bold opacity-85">Resultat</p>
      <h1 className="text-3xl leading-tight font-bold break-words">{act.title}</h1>
      <ActMembers memberIds={act.memberIds} players={players} />
      {result.data ? (
        <>
          <p className="font-display text-6xl font-bold tabular-nums">⭐ {result.data.stars.toFixed(1)}</p>
          <p className="text-xl font-bold">
            {isMember ? `Has guanyat +${result.data.points} punts! 🎉` : `+${result.data.points} punts per a cada artista`}
          </p>
          {isMember && severalActs && <p>Al rànquing compta la teua millor actuació.</p>}
        </>
      ) : (
        <p className="text-lg">{result.loading ? 'Comptant estreles…' : 'Sense vots'}</p>
      )}
    </Card>
  )
}
