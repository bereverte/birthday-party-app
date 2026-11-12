import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { PlayerGrid } from './PlayerGrid'

type Props = {
  me: Player
  players: Player[]
  online: Set<string>
  status: RealtimeStatus
}

export function Lobby({ me, players, online, status }: Props) {
  const onlineCount = players.filter((p) => online.has(p.id)).length

  return (
    <Screen>
      <div className="flex justify-end">
        <StatusPill status={status} />
      </div>

      <header className="flex items-center gap-4">
        <EmojiAvatar emoji={me.emoji} seed={me.id} size="lg" />
        <div className="min-w-0">
          <p className="text-ink-soft">Ja ets dins!</p>
          <h1 className="text-3xl leading-none font-bold break-words">Hola, {me.name}!</h1>
        </div>
      </header>

      <section className="mt-4 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Ja som aquí 🎉</h2>
          <p className="text-sm font-bold text-ink-soft">
            {players.length} dins · {onlineCount} en línia
          </p>
        </div>
        <PlayerGrid players={players} online={online} meId={me.id} />
      </section>
    </Screen>
  )
}
