import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  // Host panel uses the extra width on a laptop.
  wide?: boolean
  className?: string
}

// Page shell: mobile-first column with a 16px gutter.
export function Screen({ children, wide = false, className = '' }: Props) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-4 px-4 pt-4 pb-8 ${wide ? 'max-w-5xl' : 'max-w-md'} ${className}`}
    >
      {children}
    </main>
  )
}
