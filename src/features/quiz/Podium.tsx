import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { Rank } from '../leaderboard/rank'

// Top 3 on steps: 2nd · 1st · 3rd. Ties share a step (same rank).
const steps = [
  { rank: 2, height: 'h-20', medal: '🥈' },
  { rank: 1, height: 'h-28', medal: '🥇' },
  { rank: 3, height: 'h-14', medal: '🥉' },
]

export function Podium({ ranks }: { ranks: Rank[] }) {
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {steps.map((step) => {
        const people = ranks.filter((r) => r.rank === step.rank)
        return (
          <div key={step.rank} className="flex flex-col items-center gap-2">
            {people.map((p) => (
              <div key={p.playerId} className="flex animate-pop flex-col items-center gap-1 text-center">
                <EmojiAvatar emoji={p.emoji} seed={p.playerId} size={step.rank === 1 ? 'lg' : 'md'} />
                <p className="max-w-full truncate font-display text-lg leading-tight font-bold">{p.name}</p>
                <p className="text-sm font-bold text-ink-soft tabular-nums">{p.total} punts</p>
              </div>
            ))}
            <div
              className={`flex w-full items-start justify-center rounded-t-3xl bg-paper pt-2 text-3xl shadow-card ${step.height}`}
            >
              <span aria-hidden>{step.medal}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
