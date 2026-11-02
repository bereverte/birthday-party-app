import { useEffect } from 'react'
import { ErrorScreen } from '../components/ui/ErrorScreen'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { HostLogin } from '../features/host/HostLogin'
import { HostPanel } from '../features/host/HostPanel'
import { NotHost } from '../features/host/NotHost'
import { useIsHost } from '../features/host/useIsHost'
import { JoinForm } from '../features/join/JoinForm'
import { usePartyState } from '../hooks/usePartyState'
import { usePlayers } from '../hooks/usePlayers'
import { usePresence } from '../hooks/usePresence'
import { useSession } from '../hooks/useSession'
import { friendlyError } from '../lib/errors'
import { syncServerClock } from '../lib/serverClock'

// Thin page: loading → login → not host → join → panel.
export default function HostPage() {
  const { user, loading } = useSession()
  // An anonymous guest session in this browser doesn't count: show the login.
  const userId = user && !user.is_anonymous ? user.id : null
  const { isHost, error: hostError, recheck } = useIsHost(userId)

  const ready = isHost === true
  const players = usePlayers(ready)
  const party = usePartyState(ready)
  const me = players.data?.find((p) => p.id === userId) ?? null
  const online = usePresence(me?.id ?? null)

  useEffect(() => {
    if (ready) void syncServerClock()
  }, [ready])

  if (loading) return <LoadingScreen />
  if (!user || !userId) return <HostLogin />
  if (hostError) return <ErrorScreen message={friendlyError(hostError)} onRetry={() => void recheck()} />
  if (isHost === null) return <LoadingScreen message="Comprovant permisos…" />
  if (!isHost) return <NotHost email={user.email ?? ''} onRecheck={() => void recheck()} />

  if (!players.data || !party.data) {
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

  // The host plays challenges and the show too, so she joins like a guest.
  if (!me) return <JoinForm userId={userId} title="Tu també jugues!" onJoined={() => void players.refetch()} />

  return (
    <HostPanel
      me={me}
      party={party.data}
      players={players.data}
      online={online}
      status={party.status}
      refetchAll={() => {
        void players.refetch()
        void party.refetch()
      }}
    />
  )
}
