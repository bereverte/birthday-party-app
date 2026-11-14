import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function TextInput({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    // min-w-0 + w-full: an input's default width (~20 characters) must not push it out of a narrow
    // grid column or a phone screen.
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="truncate font-display font-bold">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={`w-full min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 text-lg transition-[border-color,box-shadow] outline-none placeholder:text-ink-soft/60 focus:border-pink focus:ring-4 focus:ring-pink/15 ${className}`}
      />
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}
