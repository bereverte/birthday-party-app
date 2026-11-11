import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from '../quiz/useKeyedRefetch'

export type ActVotes = { count: number; average: number | null; byVoter: Map<string, number> }

// Votes for one act. RLS gives a guest only their own vote and the host all
// of them, so the same hook serves "my vote" and the host's live count.
export function useActVotes(actId: string | null) {
  return useKeyedRefetch({
    name: 'act_votes',
    tables: ['show_votes'],
    key: actId,
    fetcher: async (id): Promise<ActVotes> => {
      const { data, error } = await supabase.from('show_votes').select('voter_id, score').eq('act_id', id)
      if (error) throw error
      const total = data.reduce((sum, v) => sum + v.score, 0)
      return {
        count: data.length,
        average: data.length > 0 ? total / data.length : null,
        byVoter: new Map(data.map((v) => [v.voter_id, v.score])),
      }
    },
  })
}
