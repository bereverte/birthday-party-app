import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import { supabase } from '../../lib/supabase'
import { toRanks, type Rank } from './rank'

// Party ranking: challenges + show, host included. Ties share a rank.
export function usePartyLeaderboard(enabled = true) {
  return useRealtimeRefetch({
    name: 'party_leaderboard',
    tables: ['points_ledger', 'players'],
    enabled,
    fetcher: async (): Promise<Rank[]> => {
      const { data, error } = await supabase.from('party_leaderboard').select('*').order('rank').order('name')
      if (error) throw error
      return toRanks(data)
    },
  })
}
