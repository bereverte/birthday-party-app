import { supabase } from '../lib/supabase'
import { useRealtimeRefetch } from './useRealtimeRefetch'

// The party_state singleton (DECISIONS 002): which screen everyone shows.
export function usePartyState(enabled = true) {
  return useRealtimeRefetch({
    name: 'party_state',
    tables: ['party_state'],
    enabled,
    fetcher: async () => {
      const { data, error } = await supabase.from('party_state').select('*').eq('id', 1).single()
      if (error) throw error
      return data
    },
  })
}

export type PartyState = NonNullable<ReturnType<typeof usePartyState>['data']>

// Same values as the check constraint on party_state.phase.
export const PHASES = ['lobby', 'quiz', 'challenges', 'show', 'finished'] as const
export type Phase = (typeof PHASES)[number]
