import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import { PHASES, type PartyState, type Phase } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { friendlyError } from '../../lib/errors'
import { broadcastResync } from '../../lib/partyChannel'
import { getClockOffset } from '../../lib/serverClock'
import { supabase } from '../../lib/supabase'
import { HostChallenges } from '../challenges/HostChallenges'
import { HostQuiz } from '../quiz/HostQuiz'
import { HostShow } from '../show/HostShow'

const phaseLabels: Record<Phase, string> = {
  lobby: '🎈 Lobby',
  quiz: '🧠 Quiz',
  challenges: '🏃 Proves',
  show: '🎤 Show',
  finished: '🏆 Final',
}

type Props = {
  me: Player
  party: PartyState
  players: Player[]
  online: Set<string>
  status: RealtimeStatus
  refetchAll: () => void
}

export function HostPanel({ me, party, players, online, status, refetchAll }: Props) {
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const onlineCount = players.filter((p) => online.has(p.id)).length

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key)
    setNotice(null)
    try {
      const message = await action()
      if (message) setNotice(message)
    } catch (err) {
      setNotice(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  // Direct update: the column-level grant only lets the host change
  // phase/current_challenge_id/current_act_id (DECISIONS 014).
  const changePhase = (phase: Phase) =>
    run(`phase:${phase}`, async () => {
      const { error } = await supabase.from('party_state').update({ phase }).eq('id', 1)
      if (error) throw error
    })

  const forceResync = () =>
    run('resync', async () => {
      await broadcastResync()
      // Broadcast isn't echoed to the sender.
      refetchAll()
      return 'Resync enviat a tots els mòbils ✓'
    })

  const removePlayer = (player: Player) => {
    if (!window.confirm(`Eliminar ${player.emoji} ${player.name}? Només es pot si encara no té punts ni vots.`)) return
    return run(`remove:${player.id}`, async () => {
      // RLS turns a refused delete into "0 rows", not an error.
      const { data, error } = await supabase.from('players').delete().eq('id', player.id).select('id')
      if (error) throw error
      if (data.length === 0) return `${player.name} ja té activitat i no es pot eliminar.`
      return `${player.name} eliminat.`
    })
  }

  return (
    <Screen wide>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <EmojiAvatar emoji={me.emoji} seed={me.id} />
          <div>
            <p className="text-sm text-ink-soft">👑 Amfitriona</p>
            <h1 className="text-3xl leading-none font-bold">Control de la festa</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <Button variant="ghost" onClick={() => void supabase.auth.signOut()} className="!px-3 !py-1.5 text-sm">
            Eixir
          </Button>
        </div>
      </header>

      {notice && (
        <p role="status" className="animate-pop rounded-2xl bg-sun-soft px-4 py-3 font-semibold shadow-card">
          {notice}
        </p>
      )}

      {party.phase === 'quiz' && <HostQuiz party={party} players={players} refetchParty={refetchAll} />}
      {party.phase === 'challenges' && (
        <HostChallenges party={party} players={players} refetchParty={refetchAll} />
      )}
      {party.phase === 'show' && <HostShow me={me} party={party} players={players} refetchParty={refetchAll} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Fase</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
              {PHASES.map((phase) => {
                const current = party.phase === phase
                return (
                  <Button
                    key={phase}
                    variant={current ? 'secondary' : 'ghost'}
                    aria-pressed={current}
                    loading={busy === `phase:${phase}`}
                    disabled={busy !== null && busy !== `phase:${phase}`}
                    onClick={() => void changePhase(phase)}
                  >
                    {phaseLabels[phase]}
                  </Button>
                )
              })}
            </div>
          </Card>

          <Card tone="lilac" className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">Rescat</h2>
            <p className="text-sm">Si algun mòbil s’ha quedat penjat, fes que tots tornen a llegir l’estat.</p>
            <Button variant="secondary" loading={busy === 'resync'} onClick={() => void forceResync()}>
              🔄 Force resync
            </Button>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="opacity-75">Realtime</dt>
              <dd className="font-bold">{status}</dd>
              <dt className="opacity-75">Rellotge vs servidor</dt>
              <dd className="font-bold">{getClockOffset()} ms</dd>
            </dl>
          </Card>
        </div>

        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold">Jugadors</h2>
            <p className="text-sm font-bold text-ink-soft">
              {players.length} dins · {onlineCount} en línia
            </p>
          </div>
          {players.length === 0 ? (
            <p className="text-ink-soft">Encara no ha entrat ningú.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3 py-2">
                  <EmojiAvatar emoji={player.emoji} seed={player.id} size="sm" online={online.has(player.id)} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {player.isHost && '👑 '}
                    {player.name}
                  </span>
                  {player.id !== me.id && (
                    <Button
                      variant="ghost"
                      aria-label={`Eliminar ${player.name}`}
                      loading={busy === `remove:${player.id}`}
                      onClick={() => void removePlayer(player)}
                      className="!px-2.5 !py-1 text-sm"
                    >
                      ✕
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Screen>
  )
}
