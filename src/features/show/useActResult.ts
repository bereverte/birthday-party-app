import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from '../quiz/useKeyedRefetch'

export type ActResult = { points: number; stars: number }

// The score of a closed act, read from the points ledger (every member gets
// the same points). Stars = points / show_points_per_star, so guests see the
// average without reading other people's votes. null = not scored.
export function useActResult(actId: string | null) {
  return useKeyedRefetch({
    name: 'act_result',
    tables: ['points_ledger', 'scoring_config'],
    key: actId,
    fetcher: async (id): Promise<ActResult | null> => {
      const [ledger, config] = await Promise.all([
        supabase.from('points_ledger').select('points').eq('source_type', 'show').eq('source_id', id).limit(1),
        supabase.from('scoring_config').select('show_points_per_star').eq('id', 1).single(),
      ])
      if (ledger.error) throw ledger.error
      if (config.error) throw config.error
      const points = ledger.data[0]?.points
      if (points === undefined) return null
      const perStar = config.data.show_points_per_star
      return { points, stars: perStar > 0 ? points / perStar : 0 }
    },
  })
}
