import type { Tables } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { useRealtimeRefetch } from './useRealtimeRefetch'

export type Player = Tables<'players'> & { isHost: boolean }

// Everyone who has joined, in join order, with the host flagged.
// hosts isn't published to Realtime: it only changes by hand, and any
// players event or resync picks it up.
export function usePlayers(enabled = true) {
  return useRealtimeRefetch({
    name: 'players',
    tables: ['players'],
    enabled,
    fetcher: async (): Promise<Player[]> => {
      const [players, hosts] = await Promise.all([
        supabase.from('players').select('*').order('created_at'),
        supabase.from('hosts').select('user_id'),
      ])
      if (players.error) throw players.error
      if (hosts.error) throw hosts.error
      const hostIds = new Set(hosts.data.map((h) => h.user_id))
      return players.data.map((p) => ({ ...p, isHost: hostIds.has(p.id) }))
    },
  })
}
