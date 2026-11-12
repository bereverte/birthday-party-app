import { Button } from './Button'
import { Card } from './Card'

type Props = {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
}

export function ErrorScreen({ title = 'Uf, alguna cosa ha fallat', message, onRetry, retrying }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <Card className="flex flex-col items-center gap-4 text-center">
        <span className="text-5xl" aria-hidden>
          🙈
        </span>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-ink-soft">{message}</p>
        {onRetry && (
          <Button size="lg" onClick={onRetry} loading={retrying} className="w-full">
            Torna-ho a provar
          </Button>
        )}
      </Card>
    </main>
  )
}
