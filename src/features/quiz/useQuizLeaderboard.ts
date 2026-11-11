import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import { supabase } from '../../lib/supabase'
import { toRanks, type Rank } from '../leaderboard/rank'

// Quiz ranking: guests only (the host doesn't play the quiz).
// Ties share a rank (rank() in the view).
export function useQuizLeaderboard(enabled = true) {
  return useRealtimeRefetch({
    name: 'quiz_leaderboard',
    tables: ['points_ledger', 'players'],
    enabled,
    fetcher: async (): Promise<Rank[]> => {
      const { data, error } = await supabase.from('quiz_leaderboard').select('*').order('rank').order('name')
      if (error) throw error
      return toRanks(data)
    },
  })
}
