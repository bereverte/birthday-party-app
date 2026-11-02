import { useEffect, useState } from 'react'
import { onPresenceChange, setPresence } from '../lib/partyChannel'

// Who is online right now (DECISIONS 020). Pass the current player's id to
// mark this device as online; pass null to only watch (e.g. before joining).
export function usePresence(myPlayerId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set())

  useEffect(() => onPresenceChange(setOnline), [])

  useEffect(() => {
    if (!myPlayerId) return
    setPresence(myPlayerId)
    return () => setPresence(null)
  }, [myPlayerId])

  return online
}
