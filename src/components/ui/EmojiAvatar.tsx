type Size = 'sm' | 'md' | 'lg'

type Props = {
  emoji: string
  // Seeds the background colour, so each person keeps the same one.
  seed: string
  size?: Size
  online?: boolean
}

const backgrounds = ['bg-pink', 'bg-sun', 'bg-mint', 'bg-lilac', 'bg-sky', 'bg-tomato']

const sizes: Record<Size, string> = {
  sm: 'size-10 text-xl',
  md: 'size-14 text-3xl',
  lg: 'size-24 text-6xl',
}

function hash(value: string) {
  let h = 0
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function EmojiAvatar({ emoji, seed, size = 'md', online }: Props) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full border-3 border-ink shadow-sticker-sm ${backgrounds[hash(seed) % backgrounds.length]} ${sizes[size]}`}
      >
        <span aria-hidden>{emoji}</span>
      </span>
      {online !== undefined && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-3 border-ink ${online ? 'bg-mint' : 'bg-ink-soft/40'}`}
          title={online ? 'En línia' : 'Desconnectat'}
        />
      )}
    </span>
  )
}
