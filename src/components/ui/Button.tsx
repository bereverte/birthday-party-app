import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-pink text-white border-ink shadow-sticker',
  secondary: 'bg-sun text-ink border-ink shadow-sticker',
  ghost: 'bg-paper text-ink border-ink shadow-sticker-sm',
  danger: 'bg-tomato text-white border-ink shadow-sticker-sm',
}

const sizes: Record<Size, string> = {
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-4 text-xl',
}

// Sticker button: pressing it "pushes" it into its shadow.
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border-3 font-display font-bold transition-[transform,box-shadow] duration-100 select-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-0 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span className="inline-block animate-spin">✳️</span> : children}
    </button>
  )
}
