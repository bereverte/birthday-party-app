import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function TextInput({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-display text-lg font-bold">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={`rounded-2xl border-3 border-ink bg-paper px-4 py-3 text-lg shadow-sticker-sm outline-none placeholder:text-ink-soft/60 focus:bg-white focus:ring-4 focus:ring-sun ${className}`}
      />
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}
