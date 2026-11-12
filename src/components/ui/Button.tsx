import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white shadow-lift',
  secondary: 'bg-pink text-white shadow-glow',
  ghost: 'bg-paper text-ink shadow-card',
  danger: 'bg-tomato text-white shadow-card',
}

const sizes: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
}

// Pill button that shrinks slightly when pressed.
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-display font-bold transition-transform duration-100 select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? (
        <span className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  )
}
