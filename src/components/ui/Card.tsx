import type { HTMLAttributes } from 'react'

// Tinted tones are pastel; "party" is the one loud card, for the main
// message of a screen. Use it sparingly: one per screen.
type Tone = 'paper' | 'pink' | 'sun' | 'mint' | 'lilac' | 'sky' | 'party'

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone
}

const tones: Record<Tone, string> = {
  paper: 'bg-paper shadow-card',
  pink: 'bg-pink-soft shadow-card',
  sun: 'bg-sun-soft shadow-card',
  mint: 'bg-mint-soft shadow-card',
  lilac: 'bg-lilac-soft shadow-card',
  sky: 'bg-sky-soft shadow-card',
  party: 'bg-linear-120 from-pink to-coral text-white shadow-glow',
}

export function Card({ tone = 'paper', className = '', ...rest }: Props) {
  return <div {...rest} className={`rounded-3xl p-4 ${tones[tone]} ${className}`} />
}
