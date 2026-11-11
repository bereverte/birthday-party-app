import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import { supabase } from '../../lib/supabase'

// Point buttons for the host (scoring_config.challenge_presets, DECISIONS 007).
// scoring_config isn't published to Realtime: it only changes by hand, and
// a resync or reload picks it up.
export function useChallengePresets(enabled = true) {
  return useRealtimeRefetch({
    name: 'challenge_presets',
    tables: ['scoring_config'],
    enabled,
    fetcher: async (): Promise<number[]> => {
      const { data, error } = await supabase.from('scoring_config').select('challenge_presets').eq('id', 1).single()
      if (error) throw error
      return data.challenge_presets
    },
  })
}
