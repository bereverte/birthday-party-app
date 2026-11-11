import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type ShowAct = Tables<'show_acts'> & { memberIds: string[] }

// Every act in sign-up order, with its members. Not secret.
export function useShowActs(enabled = true) {
  return useRealtimeRefetch({
    name: 'show_acts',
    tables: ['show_acts', 'show_act_members'],
    enabled,
    fetcher: async (): Promise<ShowAct[]> => {
      const { data, error } = await supabase
        .from('show_acts')
        .select('*, show_act_members(player_id)')
        .order('position')
      if (error) throw error
      return data.map(({ show_act_members, ...act }) => ({
        ...act,
        memberIds: show_act_members.map((m) => m.player_id),
      }))
    },
  })
}
