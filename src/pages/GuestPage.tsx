import { useEffect, useState, type ReactNode } from 'react'
import { ErrorScreen } from '../components/ui/ErrorScreen'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { GuestChallenges } from '../features/challenges/GuestChallenges'
import { GuestFinal } from '../features/final/GuestFinal'
import { JoinForm } from '../features/join/JoinForm'
import { Lobby } from '../features/join/Lobby'
import { useGuestSession } from '../features/join/useGuestSession'
import { GuestQuiz } from '../features/quiz/GuestQuiz'
import { GuestShow } from '../features/show/GuestShow'
import { ShowSignUp } from '../features/show/ShowSignUp'
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
  const [signingUp, setSigningUp] = useState(false)

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
  if (signingUp && phase !== 'finished') {
    return <ShowSignUp me={me} players={players.data} onClose={() => setSigningUp(false)} />
  }

  // Show sign-up is open the whole party (DECISIONS 034), except while a quiz
  // question is open, so it never distracts from answering.
  const withSignUp = (screen: ReactNode) => (
    <>
      {screen}
      {!(phase === 'quiz' && party.data?.question_status === 'open') && (
        <>
          {/* Room to scroll the last content above the button. */}
          <div className="h-16" aria-hidden />
          <button
            type="button"
            onClick={() => setSigningUp(true)}
            className="fixed right-4 bottom-4 z-10 rounded-full bg-ink px-4 py-3 font-display font-bold text-white shadow-lift transition-transform active:scale-95"
          >
            🎤 Apunta’t al show
          </button>
        </>
      )}
    </>
  )

  if (phase === 'lobby') {
    return withSignUp(<Lobby me={me} players={players.data} online={online} status={party.status} />)
  }
  if (phase === 'quiz') {
    return withSignUp(
      <GuestQuiz me={me} party={party.data} status={party.status} refetchParty={() => void party.refetch()} />,
    )
  }
  if (phase === 'challenges') {
    return withSignUp(<GuestChallenges me={me} party={party.data} status={party.status} />)
  }
  if (phase === 'show') {
    return (
      <GuestShow
        me={me}
        players={players.data}
        party={party.data}
        status={party.status}
        onSignUp={() => setSigningUp(true)}
      />
    )
  }
  return <GuestFinal me={me} status={party.status} />
}
