import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import { supabase } from '../../lib/supabase'

export type QuizRank = {
  playerId: string
  name: string
  emoji: string
  total: number
  rank: number
}

// Quiz ranking: guests only (the host doesn't play the quiz).
// Ties share a rank (rank() in the view).
export function useQuizLeaderboard(enabled = true) {
  return useRealtimeRefetch({
    name: 'quiz_leaderboard',
    tables: ['points_ledger', 'players'],
    enabled,
    fetcher: async (): Promise<QuizRank[]> => {
      const { data, error } = await supabase
        .from('quiz_leaderboard')
        .select('*')
        .order('rank')
        .order('name')
      if (error) throw error
      // Generated view types are all nullable; the view never returns nulls.
      return data.map((r) => ({
        playerId: r.player_id ?? '',
        name: r.name ?? '',
        emoji: r.emoji ?? '',
        total: r.total ?? 0,
        rank: r.rank ?? 0,
      }))
    },
  })
}
