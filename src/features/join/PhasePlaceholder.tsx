import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { Phase } from '../../hooks/usePartyState'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'

// Temporary screens until each feature exists.
const copy: Record<Exclude<Phase, 'lobby'>, { emoji: string; title: string; text: string; tone: 'pink' | 'mint' | 'lilac' | 'sky' }> = {
  quiz: { emoji: '🧠', title: 'Comença el quiz!', text: 'Prepara’t: les preguntes apareixeran ací.', tone: 'pink' },
  challenges: { emoji: '🏃', title: 'Hora de les proves!', text: 'Fes cas a l’amfitriona i dona-ho tot.', tone: 'mint' },
  show: { emoji: '🎤', title: 'El show final!', text: 'Prompte podràs votar les actuacions.', tone: 'lilac' },
  finished: { emoji: '🏆', title: 'S’ha acabat la festa!', text: 'Gràcies per vindre. Ara toca el pastís.', tone: 'sky' },
}

export function PhasePlaceholder({ phase, status }: { phase: Exclude<Phase, 'lobby'>; status: RealtimeStatus }) {
  const { emoji, title, text, tone } = copy[phase]
  return (
    <Screen>
      <div className="flex justify-end">
        <StatusPill status={status} />
      </div>
      <div className="flex flex-1 flex-col justify-center pb-16">
        <Card tone={tone} className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="animate-float text-7xl" aria-hidden>
            {emoji}
          </span>
          <h1 className="text-4xl font-extrabold">{title}</h1>
          <p className="text-lg">{text}</p>
        </Card>
      </div>
    </Screen>
  )
}
