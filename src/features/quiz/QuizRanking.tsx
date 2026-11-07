import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { QuizRank } from './useQuizLeaderboard'

type Props = {
  ranks: QuizRank[]
  limit?: number
  // Highlighted, and added at the end if it's outside the top `limit`.
  meId?: string
}

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function QuizRanking({ ranks, limit = 5, meId }: Props) {
  const top = ranks.slice(0, limit)
  const me = meId ? ranks.find((r) => r.playerId === meId) : undefined
  const rows = me && !top.includes(me) ? [...top, me] : top

  if (rows.length === 0) return null

  return (
    <Card className="flex flex-col gap-1 p-3">
      {rows.map((r, i) => {
        const mine = r.playerId === meId
        const gap = i > 0 && r.rank > rows[i - 1].rank + 1 && i === rows.length - 1 && r === me
        return (
          <div key={r.playerId}>
            {gap && (
              <p className="py-0.5 text-center text-ink-soft" aria-hidden>
                ⋯
              </p>
            )}
            <div className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${mine ? 'bg-pink-soft' : ''}`}>
              <span className="w-8 text-center font-display text-lg font-bold tabular-nums">
                {medals[r.rank] ?? r.rank}
              </span>
              <EmojiAvatar emoji={r.emoji} seed={r.playerId} size="sm" />
              <span className="min-w-0 flex-1 truncate font-bold">
                {r.name}
                {mine && <span className="font-normal text-ink-soft"> (tu)</span>}
              </span>
              <span className="font-display font-bold tabular-nums">{r.total}</span>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
