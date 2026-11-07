import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { StatusPill } from '../../components/ui/StatusPill'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { CountdownBadge } from './CountdownBadge'
import { optionStyle } from './optionStyles'
import { QuizRanking } from './QuizRanking'
import { useAutoCloseQuestion } from './useAutoCloseQuestion'
import { useCountdown } from './useCountdown'
import { useCurrentQuestion, type CurrentQuestion } from './useCurrentQuestion'
import { useMyAnswer } from './useMyAnswer'
import { useQuizLeaderboard } from './useQuizLeaderboard'

type Props = {
  me: Player
  party: PartyState
  status: RealtimeStatus
  refetchParty: () => void
}

// The guest's quiz: waiting → question open → answered / time up → reveal
// with points and ranking. Everything is derived from party_state and the
// database, so closing the tab and coming back lands on the same screen.
export function GuestQuiz({ me, party, status, refetchParty }: Props) {
  const current = useCurrentQuestion(party)
  const questionId = current.data?.question.id ?? null
  const answer = useMyAnswer(questionId, me.id)
  const ranking = useQuizLeaderboard()

  const open = party.question_status === 'open'
  const seconds = useCountdown(party.question_closes_at, open)
  useAutoCloseQuestion(party, refetchParty)

  // Chosen option while the RPC is on its way (and before the refetch).
  const [pending, setPending] = useState<{ questionId: string; optionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingOption = pending && pending.questionId === questionId ? pending.optionId : null
  const chosen = answer.data?.optionId ?? pendingOption

  async function choose(optionId: string) {
    if (!questionId || chosen) return
    setPending({ questionId, optionId })
    setError(null)
    const { error: rpcError } = await supabase.rpc('submit_answer', {
      p_question_id: questionId,
      p_option_id: optionId,
    })
    if (rpcError) {
      setPending(null)
      setError(friendlyError(rpcError))
    }
    void answer.refetch()
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <p className="font-display text-lg font-bold">🧠 Quiz</p>
      <StatusPill status={status} />
    </div>
  )

  // No question opened yet (or the host went back to idle).
  if (party.question_status === 'idle' || !party.current_question_id) {
    return (
      <Screen>
        {header}
        <div className="flex flex-1 flex-col justify-center pb-16">
          <Card tone="party" className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="animate-float text-7xl" aria-hidden>
              🧠
            </span>
            <h1 className="text-4xl font-bold">Comença el quiz!</h1>
            <p className="text-lg">Quant saps de l’amfitriona? La primera pregunta arriba de seguida.</p>
          </Card>
        </div>
      </Screen>
    )
  }

  if (!current.data) {
    return (
      <Screen>
        {header}
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-xl font-semibold">{current.error ? friendlyError(current.error) : 'Carregant la pregunta…'}</p>
        </div>
      </Screen>
    )
  }

  // Wait for the correct option too: right after the reveal the data may
  // still be the pre-reveal read, and "wrong!" must never flash.
  const revealed = party.question_status === 'revealed' && current.data.correctOptionId !== null
  const timeUp = !open || seconds === 0

  return (
    <Screen>
      {header}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-soft">Pregunta {current.data.question.position}</p>
          <h1 className="text-3xl leading-tight font-bold break-words">{current.data.question.text}</h1>
        </div>
        {open && <CountdownBadge seconds={seconds} />}
      </div>

      {current.data.question.image_url && (
        <img src={current.data.question.image_url} alt="" className="max-h-60 w-full rounded-3xl object-cover shadow-card" />
      )}

      {revealed && (
        <RevealCard data={current.data} chosen={chosen} points={answer.data?.points ?? null} loading={!answer.data} />
      )}

      <Options
        data={current.data}
        chosen={chosen}
        revealed={revealed}
        disabled={!!chosen || timeUp}
        onChoose={(id) => void choose(id)}
      />

      {error && <p className="text-center font-bold text-tomato">{error}</p>}

      {!revealed && <StatusLine chosen={!!chosen} timeUp={timeUp} />}

      {revealed && ranking.data && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Rànquing</h2>
          <QuizRanking ranks={ranking.data} meId={me.id} />
        </section>
      )}
    </Screen>
  )
}

function Options({
  data,
  chosen,
  revealed,
  disabled,
  onChoose,
}: {
  data: CurrentQuestion
  chosen: string | null
  revealed: boolean
  disabled: boolean
  onChoose: (optionId: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {data.options.map((option, i) => {
        const style = optionStyle(i)
        const mine = option.id === chosen
        const correct = revealed && option.id === data.correctOptionId
        // Before the reveal: dim the options I didn't pick. After: dim the wrong ones.
        const dimmed = revealed ? !correct : !!chosen && !mine
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(option.id)}
            aria-pressed={mine}
            className={`flex min-h-16 items-center gap-3 rounded-3xl px-4 py-3 text-left text-white shadow-card transition duration-150 active:scale-[0.98] disabled:active:scale-100 ${style.bg} ${dimmed ? 'opacity-35' : ''} ${mine && !revealed ? 'scale-[1.02] shadow-lift' : ''}`}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/25 font-display text-lg font-bold">
              {correct ? '✓' : style.letter}
            </span>
            <span className="min-w-0 flex-1 font-display text-xl leading-tight font-bold break-words">{option.text}</span>
            {mine && <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold">La teua</span>}
          </button>
        )
      })}
    </div>
  )
}

function StatusLine({ chosen, timeUp }: { chosen: boolean; timeUp: boolean }) {
  const text = chosen
    ? timeUp
      ? 'Temps! Ara veurem si l’has encertada…'
      : 'Resposta enviada ✓ Esperant els altres…'
    : timeUp
      ? '⏰ S’ha acabat el temps!'
      : 'Tria una resposta. Com més ràpid, més punts!'
  return <p className="text-center font-bold text-ink-soft">{text}</p>
}

function RevealCard({
  data,
  chosen,
  points,
  loading,
}: {
  data: CurrentQuestion
  chosen: string | null
  points: number | null
  loading: boolean
}) {
  if (loading) return null
  const right = chosen !== null && chosen === data.correctOptionId

  const { emoji, title, text } = right
    ? { emoji: '🎉', title: 'Correcte!', text: points !== null ? `+${points} punts` : 'Sumant punts…' }
    : chosen
      ? { emoji: '🙈', title: 'Uf, no era aquesta', text: 'La pròxima segur que sí.' }
      : { emoji: '⏰', title: 'No has respost', text: 'A la pròxima, més ràpid!' }

  return (
    <Card tone={right ? 'party' : 'paper'} className="flex animate-pop items-center gap-4">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <p className="font-display text-2xl leading-tight font-bold">{title}</p>
        <p className={right ? 'text-white' : 'text-ink-soft'}>{text}</p>
      </div>
    </Card>
  )
}
