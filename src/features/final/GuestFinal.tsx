import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { FinalResults } from './FinalResults'

export function GuestFinal({ me, status }: { me: Player; status: RealtimeStatus }) {
  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-2xl font-bold tracking-tight">🏆 Final</p>
        <StatusPill status={status} />
      </div>
      <FinalResults meId={me.id} />
    </Screen>
  )
}
