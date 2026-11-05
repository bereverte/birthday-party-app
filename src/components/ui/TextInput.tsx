import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function TextInput({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-display font-bold">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={`rounded-2xl border border-line bg-paper px-4 py-3 text-lg transition-[border-color,box-shadow] outline-none placeholder:text-ink-soft/60 focus:border-pink focus:ring-4 focus:ring-pink/15 ${className}`}
      />
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}
