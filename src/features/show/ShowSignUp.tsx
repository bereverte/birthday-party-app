import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import type { Player } from '../../hooks/usePlayers'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { ActMembers } from './ActMembers'
import { actKind } from './actKind'
import { actStatusLabels, actStatusTones } from './actStatus'
import { SignUpForm } from './SignUpForm'
import { useShowActs } from './useShowActs'

type Props = {
  me: Player
  players: Player[]
  onClose: () => void
}

// The guest's "my acts" screen, open from any phase: sign up (solo, pair or
// group) and withdraw an act before it goes on stage.
export function ShowSignUp({ me, players, onClose }: Props) {
  const acts = useShowActs()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const mine = acts.data?.filter((a) => a.memberIds.includes(me.id)) ?? []

  const withdraw = async (id: string, title: string) => {
    if (!window.confirm(`Retirar «${title}» del show?`)) return
    setBusy(id)
    setNotice(null)
    const { error } = await supabase.rpc('withdraw_act', { p_act_id: id })
    setBusy(null)
    if (error) setNotice(friendlyError(error))
    else void acts.refetch()
  }

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onClose} className="px-3! py-1.5! text-sm">
          ← Tornar
        </Button>
      </div>

      <Card tone="party" className="flex flex-col gap-2">
        <span className="text-5xl" aria-hidden>
          🎤
        </span>
        <h1 className="text-4xl leading-tight font-bold">El show final</h1>
        <p>Canta, balla, conta un acudit… Sol, en parella o en grup. Tothom vota cada actuació amb estreles.</p>
      </Card>

      {notice && (
        <p role="status" className="animate-pop rounded-2xl bg-sun-soft px-4 py-3 font-semibold shadow-card">
          {notice}
        </p>
      )}

      {adding || (acts.data && mine.length === 0) ? (
        <SignUpForm
          me={me}
          players={players}
          onDone={(created) => {
            setAdding(false)
            if (created) {
              void acts.refetch()
              setNotice('Apuntat! 🎉 L’amfitriona et cridarà quan et toque.')
            } else if (mine.length === 0) {
              onClose()
            }
          }}
        />
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setAdding(true)}>
          + Apuntar una altra actuació
        </Button>
      )}

      {!!acts.error && !acts.data && <p className="text-ink-soft">{friendlyError(acts.error)}</p>}

      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Les meues actuacions</h2>
          {mine.map((act) => (
            <Card key={act.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-soft">{actKind(act.memberIds.length)}</p>
                  <h3 className="text-xl leading-tight font-bold break-words">{act.title}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${actStatusTones[act.status]}`}>
                  {actStatusLabels[act.status] ?? act.status}
                </span>
              </div>
              <ActMembers memberIds={act.memberIds} players={players} />
              {act.status === 'pending' && act.created_by === me.id && (
                <Button
                  variant="ghost"
                  className="self-start px-3! py-1.5! text-sm"
                  loading={busy === act.id}
                  onClick={() => void withdraw(act.id, act.title)}
                >
                  Retirar
                </Button>
              )}
            </Card>
          ))}
        </section>
      )}
    </Screen>
  )
}
