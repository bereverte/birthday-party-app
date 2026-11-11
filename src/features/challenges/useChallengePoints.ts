import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from '../quiz/useKeyedRefetch'

// Points awarded in one challenge, by player id. A player without a row
// hasn't been scored yet in this challenge.
export function useChallengePoints(challengeId: string | null) {
  return useKeyedRefetch({
    name: 'challenge_points',
    tables: ['points_ledger'],
    key: challengeId,
    fetcher: async (id): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('points_ledger')
        .select('player_id, points')
        .eq('source_type', 'challenge')
        .eq('source_id', id)
      if (error) throw error
      return new Map(data.map((r) => [r.player_id, r.points]))
    },
  })
}
