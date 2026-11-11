import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import type { Player } from '../../hooks/usePlayers'

type Props = {
  memberIds: string[]
  players: Player[]
  size?: 'sm' | 'md'
}

// The people in an act: avatars and names.
export function ActMembers({ memberIds, players, size = 'sm' }: Props) {
  const members = memberIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined)

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2">
      {members.map((p) => (
        <li key={p.id} className="flex items-center gap-1.5">
          <EmojiAvatar emoji={p.emoji} seed={p.id} size={size} />
          <span className="font-bold">{p.name}</span>
        </li>
      ))}
    </ul>
  )
}
