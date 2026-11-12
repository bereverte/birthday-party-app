import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import { supabase } from '../../lib/supabase'
import { toRanks, type Rank } from './rank'

// The single global ranking (DECISIONS 035): quiz + challenges + best show
// act, guests only. Ties share a rank.
export function useLeaderboard(enabled = true) {
  return useRealtimeRefetch({
    name: 'leaderboard',
    tables: ['points_ledger', 'players'],
    enabled,
    fetcher: async (): Promise<Rank[]> => {
      const { data, error } = await supabase.from('leaderboard').select('*').order('rank').order('name')
      if (error) throw error
      return toRanks(data)
    },
  })
}
