import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { Player } from '../../hooks/usePlayers'

type Props = {
  players: Player[]
  online: Set<string>
  meId?: string
}

// Who has joined (players table) with who is here right now (Presence).
export function PlayerGrid({ players, online, meId }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
      {players.map((player) => (
        <li key={player.id} className="flex animate-pop flex-col items-center gap-1 text-center">
          <EmojiAvatar emoji={player.emoji} seed={player.id} online={online.has(player.id)} />
          <span className="w-full truncate text-sm font-bold">
            {player.isHost && '👑 '}
            {player.name}
            {player.id === meId && <span className="text-ink-soft"> (tu)</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
