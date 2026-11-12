import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { Rank } from './rank'

type Props = {
  ranks: Rank[]
  meId: string
}

// "Where am I": the player just ahead, me, the player just behind.
// The guest view during the party; the full list is kept for the end of the
// quiz and the final screen, so phones aren't flooded with 30 names.
export function PositionCard({ ranks, meId }: Props) {
  const i = ranks.findIndex((r) => r.playerId === meId)
  // The host isn't in the rankings.
  if (i === -1) return null

  const me = ranks[i]
  const ahead = ranks[i - 1]
  const behind = ranks[i + 1]

  return (
    <Card className="flex flex-col gap-1 p-3">
      {me.rank === 1 && (
        <p className="px-2 pb-1 font-display text-lg font-bold">
          {ranks.filter((r) => r.rank === 1).length > 1 ? 'Empat al primer lloc! 🥇' : 'Vas primer/a! 🥇'}
        </p>
      )}
      {ahead && <Row rank={ahead} note={gapNote(ahead.total - me.total, 'ahead')} />}
      <Row rank={me} mine />
      {behind && <Row rank={behind} note={gapNote(me.total - behind.total, 'behind')} />}
    </Card>
  )
}

function gapNote(gap: number, side: 'ahead' | 'behind') {
  if (gap === 0) return 'empat'
  return side === 'ahead' ? `et trau ${gap}` : `li treus ${gap}`
}

function Row({ rank: r, mine = false, note }: { rank: Rank; mine?: boolean; note?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${mine ? 'bg-pink-soft' : ''}`}>
      <span className="w-8 text-center font-display text-lg font-bold tabular-nums">{r.rank}</span>
      <EmojiAvatar emoji={r.emoji} seed={r.playerId} size="sm" />
      <span className="min-w-0 flex-1 truncate font-bold">
        {r.name}
        {mine && <span className="font-normal text-ink-soft"> (tu)</span>}
        {note && <span className="block text-xs font-normal text-ink-soft">{note}</span>}
      </span>
      <span className="font-display font-bold tabular-nums">{r.total}</span>
    </div>
  )
}
