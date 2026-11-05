import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { supabase } from '../../lib/supabase'

// Signed in, but no row in hosts. Shows how to fix it (README).
export function NotHost({ email, onRecheck }: { email: string; onRecheck: () => void }) {
  return (
    <Screen className="justify-center">
      <Card className="flex flex-col gap-4">
        <span className="text-5xl" aria-hidden>
          🔒
        </span>
        <h1 className="text-3xl font-extrabold">Aquest compte no és d’amfitriona</h1>
        <p>
          Has entrat com a <strong className="break-all">{email}</strong>, però no té permisos per controlar la festa.
        </p>
        <p className="text-sm text-ink-soft">Per fer-lo amfitrió, executa això al SQL Editor de Supabase:</p>
        <pre className="overflow-x-auto rounded-2xl border-3 border-ink bg-ink p-3 text-xs text-cream">
          {`insert into public.hosts (user_id)\nselect id from auth.users\nwhere email = '${email}';`}
        </pre>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRecheck} className="flex-1">
            Ja està, comprova-ho
          </Button>
          <Button variant="ghost" onClick={() => void supabase.auth.signOut()} className="flex-1">
            Tancar sessió
          </Button>
        </div>
      </Card>
    </Screen>
  )
}
