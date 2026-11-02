import type { HTMLAttributes } from 'react'

type Tone = 'paper' | 'pink' | 'sun' | 'mint' | 'lilac' | 'sky'

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone
  // Slight rotation for the cut-out look. Use sparingly: one per screen.
  tilt?: 'left' | 'right'
}

const tones: Record<Tone, string> = {
  paper: 'bg-paper',
  pink: 'bg-pink text-white',
  sun: 'bg-sun',
  mint: 'bg-mint',
  lilac: 'bg-lilac',
  sky: 'bg-sky',
}

const tilts = { left: '-rotate-1', right: 'rotate-1' }

export function Card({ tone = 'paper', tilt, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-3xl border-3 border-ink p-5 shadow-sticker ${tones[tone]} ${tilt ? tilts[tilt] : ''} ${className}`}
    />
  )
}
