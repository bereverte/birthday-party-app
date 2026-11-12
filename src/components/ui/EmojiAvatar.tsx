type Size = 'sm' | 'md' | 'lg'

type Props = {
  emoji: string
  // Seeds the background colour, so each person keeps the same one.
  seed: string
  size?: Size
  online?: boolean
}

const backgrounds = ['bg-pink-soft', 'bg-sun-soft', 'bg-mint-soft', 'bg-lilac-soft', 'bg-sky-soft', 'bg-coral-soft']

const sizes: Record<Size, string> = {
  sm: 'size-10 text-xl',
  md: 'size-14 text-2xl',
  lg: 'size-20 text-4xl',
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
        className={`inline-flex items-center justify-center rounded-full border-3 border-paper shadow-card ${backgrounds[hash(seed) % backgrounds.length]} ${sizes[size]}`}
      >
        <span aria-hidden>{emoji}</span>
      </span>
      {online !== undefined && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-paper ${online ? 'bg-mint' : 'bg-line'}`}
          title={online ? 'En línia' : 'Desconnectat'}
        />
      )}
    </span>
  )
}
