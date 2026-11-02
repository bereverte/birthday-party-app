import { useEffect } from 'react'
import { ErrorScreen } from '../components/ui/ErrorScreen'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { JoinForm } from '../features/join/JoinForm'
import { Lobby } from '../features/join/Lobby'
import { PhasePlaceholder } from '../features/join/PhasePlaceholder'
import { useGuestSession } from '../features/join/useGuestSession'
import { usePartyState, type Phase } from '../hooks/usePartyState'
import { usePlayers } from '../hooks/usePlayers'
import { usePresence } from '../hooks/usePresence'
import { friendlyError } from '../lib/errors'
import { syncServerClock } from '../lib/serverClock'

// Thin page: session → player → pick the screen from party_state.phase.
export default function GuestPage() {
  const { user, error: signInError, signingIn, retry } = useGuestSession()
  const userId = user?.id ?? null

  const players = usePlayers(!!userId)
  const party = usePartyState(!!userId)
  const me = players.data?.find((p) => p.id === userId) ?? null
  const online = usePresence(me?.id ?? null)

  useEffect(() => {
    if (userId) void syncServerClock()
  }, [userId])

  if (signInError) {
    return (
      <ErrorScreen
        title="No hem pogut entrar a la festa"
        message={signInError}
        onRetry={retry}
        retrying={signingIn}
      />
    )
  }

  if (!userId || !players.data || !party.data) {
    const loadError = players.error ?? party.error
    if (loadError) {
      return (
        <ErrorScreen
          message={friendlyError(loadError)}
          onRetry={() => {
            void players.refetch()
            void party.refetch()
          }}
        />
      )
    }
    return <LoadingScreen />
  }

  // Not joined yet, or removed by the host: same session, join again.
  if (!me) return <JoinForm userId={userId} onJoined={() => void players.refetch()} />

  const phase = party.data.phase as Phase
  if (phase === 'lobby') {
    return <Lobby me={me} players={players.data} online={online} status={party.status} />
  }
  return <PhasePlaceholder phase={phase} status={party.status} />
}
