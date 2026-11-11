export type Rank = {
  playerId: string
  name: string
  emoji: string
  total: number
  rank: number
}

type LeaderboardRow = {
  player_id: string | null
  name: string | null
  emoji: string | null
  total: number | null
  rank: number | null
}

// Generated view types are all nullable; the views never return nulls.
export function toRanks(rows: LeaderboardRow[]): Rank[] {
  return rows.map((r) => ({
    playerId: r.player_id ?? '',
    name: r.name ?? '',
    emoji: r.emoji ?? '',
    total: r.total ?? 0,
    rank: r.rank ?? 0,
  }))
}
