export function LoadingScreen({ message = 'Inflant globus…' }: { message?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="animate-float text-6xl" aria-hidden>
        🎈
      </span>
      <p className="font-display text-xl font-bold">{message}</p>
    </main>
  )
}
