type Props = {
  value: number | null
  onChange: (score: number) => void
  disabled?: boolean
}

const labels = ['Fluixet', 'Bé', 'Molt bé', 'Genial', 'Espectacular!']

// 1-5 stars, big enough to tap on a phone. The last tapped star is the vote.
export function StarPicker({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div role="radiogroup" aria-label="La teua puntuació" className="flex gap-1">
        {labels.map((label, i) => {
          const score = i + 1
          const on = value !== null && score <= value
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} ${score === 1 ? 'estrella' : 'estrelles'}: ${label}`}
              disabled={disabled}
              onClick={() => onChange(score)}
              className={`text-4xl transition-transform duration-100 active:scale-90 disabled:cursor-not-allowed sm:text-5xl ${on ? 'scale-110' : 'opacity-35 grayscale'}`}
            >
              ⭐
            </button>
          )
        })}
      </div>
      <p className="h-6 font-display text-lg font-bold">{value !== null ? labels[value - 1] : ''}</p>
    </div>
  )
}
