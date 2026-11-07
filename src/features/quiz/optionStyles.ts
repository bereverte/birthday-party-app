// One vivid colour and a letter per option position, so the host's screen
// and the guests' phones can say "the pink one" / "B" and mean the same thing.
export const OPTION_STYLES = [
  { letter: 'A', bg: 'bg-pink', soft: 'bg-pink-soft' },
  { letter: 'B', bg: 'bg-sun', soft: 'bg-sun-soft' },
  { letter: 'C', bg: 'bg-sky', soft: 'bg-sky-soft' },
  { letter: 'D', bg: 'bg-mint', soft: 'bg-mint-soft' },
  { letter: 'E', bg: 'bg-lilac', soft: 'bg-lilac-soft' },
  { letter: 'F', bg: 'bg-coral', soft: 'bg-coral-soft' },
] as const

export function optionStyle(index: number) {
  return OPTION_STYLES[index % OPTION_STYLES.length]
}
