import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

// One shared channel for everything ephemeral (DECISIONS 010):
// - Broadcast "resync": the host's rescue button, every client refetches.
// - Presence: who is online right now.
//
// Both need the same topic on every device, so this is a module-level
// singleton created once and never removed. (removeChannel is async, and
// supabase.channel() returns the existing channel for a topic, so tearing it
// down and recreating it on React remounts would hand back a closing channel.)
//
// The user id goes in the presence payload instead of the presence key, so
// the channel doesn't depend on who is signed in (the host goes from
// anonymous to signed in without recreating it).

type PresencePayload = { user_id: string }

let channel: RealtimeChannel | null = null
let trackedUserId: string | null = null
let online = new Set<string>()

const resyncListeners = new Set<() => void>()
const presenceListeners = new Set<(online: Set<string>) => void>()

function getChannel(): RealtimeChannel {
  if (channel) return channel

  const ch = supabase.channel('party')
  ch.on('broadcast', { event: 'resync' }, () => {
    resyncListeners.forEach((listener) => listener())
  })
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState<PresencePayload>()
    // Several tabs of the same person show up as several entries: a Set
    // counts them once.
    online = new Set(Object.values(state).flatMap((entries) => entries.map((p) => p.user_id)))
    presenceListeners.forEach((listener) => listener(online))
  })
  // Presence is lost when the socket drops, so track again on every
  // (re)subscribe.
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED' && trackedUserId) void ch.track({ user_id: trackedUserId })
  })

  channel = ch
  return ch
}

export function onResync(listener: () => void): () => void {
  getChannel()
  resyncListeners.add(listener)
  return () => {
    resyncListeners.delete(listener)
  }
}

// Broadcast is not echoed to the sender by default: the caller refetches
// its own data separately.
export async function broadcastResync(): Promise<void> {
  const result = await getChannel().send({ type: 'broadcast', event: 'resync', payload: {} })
  if (result !== 'ok') throw new Error(`Resync failed: ${result}`)
}

export function onPresenceChange(listener: (online: Set<string>) => void): () => void {
  getChannel()
  presenceListeners.add(listener)
  listener(online)
  return () => {
    presenceListeners.delete(listener)
  }
}

// Mark this device as online for userId (or offline with null).
export function setPresence(userId: string | null): void {
  trackedUserId = userId
  const ch = getChannel()
  // Not joined yet: the subscribe callback tracks once it is.
  if (ch.state !== 'joined') return
  if (userId) void ch.track({ user_id: userId })
  else void ch.untrack()
}
