import { useEffect, useRef } from 'react'

type Props = {
  value: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}

const HOLD_DELAY_MS = 400
const REPEAT_MS = 120

// − number +, from 0 to max. Holding a button keeps counting.
export function NumberPicker({ value, max, onChange, disabled = false }: Props) {
  return (
    <div className="flex items-center justify-center gap-5">
      <StepButton label="Menys" step={-1} value={value} max={max} onChange={onChange} disabled={disabled}>
        −
      </StepButton>
      <span
        aria-live="polite"
        className="w-28 text-center font-display text-6xl leading-none font-bold tabular-nums"
      >
        {value}
      </span>
      <StepButton label="Més" step={1} value={value} max={max} onChange={onChange} disabled={disabled}>
        +
      </StepButton>
    </div>
  )
}

function StepButton({
  label,
  step,
  value,
  max,
  onChange,
  disabled,
  children,
}: {
  label: string
  step: 1 | -1
  value: number
  max: number
  onChange: (value: number) => void
  disabled: boolean
  children: string
}) {
  // The latest value, read by the repeat timer.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({})

  function stop() {
    clearTimeout(timers.current.hold)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }

  function bump() {
    const next = Math.min(max, Math.max(0, valueRef.current + step))
    if (next === valueRef.current) return stop()
    valueRef.current = next
    onChange(next)
  }

  useEffect(() => stop, [])

  const atLimit = step === 1 ? value >= max : value <= 0

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || atLimit}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        bump()
        timers.current.hold = setTimeout(() => {
          timers.current.repeat = setInterval(bump, REPEAT_MS)
        }, HOLD_DELAY_MS)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard users: Enter/Space fire click without pointer events.
      onClick={(e) => {
        if (e.detail === 0) bump()
      }}
      className="inline-flex size-20 shrink-0 touch-manipulation items-center justify-center rounded-full bg-paper font-display text-4xl font-bold shadow-card select-none active:scale-95 disabled:opacity-35 disabled:active:scale-100"
    >
      {children}
    </button>
  )
}
