import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { PositionCard } from '../leaderboard/PositionCard'
import { useLeaderboard } from '../leaderboard/useLeaderboard'
import { useChallengePoints } from './useChallengePoints'
import { useChallenges } from './useChallenges'

type Props = {
  me: Player
  party: PartyState
  status: RealtimeStatus
}

// The guest's challenge screen: the current challenge (or "next one soon"),
// my points in it once the host scores me, and the global ranking.
export function GuestChallenges({ me, party, status }: Props) {
  const challenges = useChallenges()
  const ranking = useLeaderboard()
  const currentId = party.current_challenge_id
  const points = useChallengePoints(currentId)

  const current = challenges.data?.find((c) => c.id === currentId) ?? null
  const myPoints = points.data?.get(me.id)

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-bold">🏃 Proves</p>
        <StatusPill status={status} />
      </div>

      {current ? (
        <Card tone="party" className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="animate-float text-7xl" aria-hidden>
            {current.emoji}
          </span>
          <h1 className="text-4xl font-bold">{current.name}</h1>
          {current.description && <p className="text-lg">{current.description}</p>}
        </Card>
      ) : (
        <Card tone="party" className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="animate-float text-7xl" aria-hidden>
            ⏳
          </span>
          <h1 className="text-4xl font-bold">La següent prova arriba aviat</h1>
          <p className="text-lg">Fes cas a l’amfitriona i prepara’t.</p>
        </Card>
      )}

      {current && myPoints !== undefined && (
        <Card tone="mint" className="animate-pop text-center">
          <p className="font-display text-2xl font-bold">
            {myPoints > 0 ? `Has guanyat +${myPoints} punts! 🎉` : 'Puntuat en aquesta prova'}
          </p>
        </Card>
      )}

      {ranking.data && ranking.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Rànquing general</h2>
          <PositionCard ranks={ranking.data} meId={me.id} />
        </section>
      )}
    </Screen>
  )
}
