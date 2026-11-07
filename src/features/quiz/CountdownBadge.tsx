// Seconds left, in a round badge that turns red for the last 5 seconds.
export function CountdownBadge({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null
  const urgent = seconds <= 5
  return (
    <span
      role="timer"
      aria-label={`${seconds} segons`}
      className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold tabular-nums shadow-card transition-colors ${urgent ? 'bg-tomato text-white' : 'bg-paper text-ink'}`}
    >
      {seconds}
    </span>
  )
}
