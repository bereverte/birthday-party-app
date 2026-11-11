import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type Challenge = Tables<'challenges'>

// Every challenge in order. Not secret: guests read it to show the current one.
export function useChallenges(enabled = true) {
  return useRealtimeRefetch({
    name: 'challenges',
    tables: ['challenges'],
    enabled,
    fetcher: async (): Promise<Challenge[]> => {
      const { data, error } = await supabase.from('challenges').select('*').order('position')
      if (error) throw error
      return data
    },
  })
}
