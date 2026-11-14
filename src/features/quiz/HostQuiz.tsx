import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { CountdownBadge } from './CountdownBadge'
import { optionStyle } from './optionStyles'
import { QuestionText } from './QuestionText'
import { mainTextAnswer } from './useCurrentQuestion'
import { Podium } from '../leaderboard/Podium'
import { Ranking } from '../leaderboard/Ranking'
import { useAnswerCount } from './useAnswerCount'
import { useAutoCloseQuestion } from './useAutoCloseQuestion'
import { useCountdown } from './useCountdown'
import { useQuizLeaderboard } from './useQuizLeaderboard'
import { useQuizQuestions } from './useQuizQuestions'

type Props = {
  party: PartyState
  players: Player[]
  refetchParty: () => void
}

// The host's quiz controls: open → (auto) close / close now → reveal →
// ranking → next. The correct option is only marked after the reveal, so
// this screen can go on a projector.
export function HostQuiz({ party, players, refetchParty }: Props) {
  const questions = useQuizQuestions()
  const ranking = useQuizLeaderboard()
  const status = party.question_status
  const questionId = status !== 'idle' ? party.current_question_id : null
  const answers = useAnswerCount(status === 'open' ? questionId : null)

  const open = status === 'open'
  const seconds = useCountdown(party.question_closes_at, open)
  useAutoCloseQuestion(party, refetchParty)

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function rpc(key: string, call: () => PromiseLike<{ error: unknown }>) {
    setBusy(key)
    setError(null)
    const { error: rpcError } = await call()
    if (rpcError) setError(friendlyError(rpcError))
    setBusy(null)
    refetchParty()
  }

  const setQuizPodium = (on: boolean) =>
    rpc('podium', () => supabase.from('party_state').update({ quiz_podium: on }).eq('id', 1))
  const openQuestion = (id: string) => {
    // Opening a question already hides the podium on the phones; reset the flag
    // so it doesn't come back at that question's reveal.
    if (party.quiz_podium) void supabase.from('party_state').update({ quiz_podium: false }).eq('id', 1)
    void rpc(`open:${id}`, () => supabase.rpc('open_question', { p_question_id: id }))
  }
  const closeNow = () => void rpc('close', () => supabase.rpc('close_question'))
  const reveal = () => void rpc('reveal', () => supabase.rpc('reveal_question'))

  if (!questions.data) {
    return (
      <Card>
        <p className="font-bold">{questions.error ? friendlyError(questions.error) : 'Carregant preguntes…'}</p>
      </Card>
    )
  }

  const list = questions.data
  const index = list.findIndex((q) => q.id === questionId)
  const current = index >= 0 ? list[index] : null
  const next = list[index + 1] ?? null
  const lastRevealed = status === 'revealed' && !!current && !next
  const podiumOn = party.quiz_podium && status === 'revealed'
  const guests = players.filter((p) => !p.isHost).length

  if (list.length === 0) {
    return (
      <Card tone="sun">
        <p className="font-bold">No hi ha preguntes carregades. Mira el README: “Carregar les preguntes”.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            🧠 Quiz
            {current && (
              <span className="text-ink-soft">
                {' '}
                · {index + 1} de {list.length}
              </span>
            )}
          </h2>
          {open && <CountdownBadge seconds={seconds} />}
        </div>

        {!current && (
          <p className="text-ink-soft">
            {list.length} preguntes a punt. Quan tothom estigue dins, obre la primera.
          </p>
        )}

        {current && (
          <>
            {current.kind !== 'single' && (
              <p className="-mb-3 text-sm font-bold text-lilac">
                {current.kind === 'multi'
                  ? '☑️ Pots marcar-ne més d’una'
                  : current.kind === 'text'
                    ? '✍️ Resposta escrita'
                    : `🔢 Tria un número del 0 al ${current.number_max}`}
              </p>
            )}
            <p className="font-display text-2xl leading-tight font-bold break-words">
              <QuestionText text={current.text} />
            </p>
            {current.image_url && (
              <img src={current.image_url} alt="" className="max-h-72 w-full rounded-3xl object-cover shadow-card" />
            )}
            {current.kind === 'text' && status === 'revealed' && (
              <div className="flex animate-pop flex-col items-center gap-1 rounded-3xl bg-mint-soft px-4 py-5 text-center shadow-card">
                <p className="font-bold text-ink-soft">La resposta era</p>
                <p className="font-display text-4xl leading-none font-bold break-words">
                  {mainTextAnswer(current.textKeys)}
                </p>
                {current.textKeys.some((k) => k.credit < 1) && (
                  <p className="text-sm text-ink-soft">
                    Mig punt: {current.textKeys.filter((k) => k.credit < 1).map((k) => k.answer).join(', ')}
                  </p>
                )}
              </div>
            )}
            {status === 'revealed' && current.revealImageUrl && (
              <img src={current.revealImageUrl} alt="" className="max-h-80 w-full animate-pop rounded-3xl object-cover shadow-card" />
            )}
            {current.kind === 'number' && status === 'revealed' && (
              <div className="flex animate-pop flex-col items-center gap-1 rounded-3xl bg-mint-soft py-5 shadow-card">
                <p className="font-bold text-ink-soft">La resposta era</p>
                <p className="font-display text-6xl leading-none font-bold tabular-nums">{current.correctNumber}</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {current.options.map((option, i) => {
                const style = optionStyle(i)
                const correct = status === 'revealed' && current.correctOptionIds.includes(option.id)
                const dimmed = status === 'revealed' && !correct
                return (
                  <div
                    key={option.id}
                    className={`flex min-h-14 items-center gap-3 rounded-3xl px-4 py-3 text-white shadow-card transition-opacity ${style.bg} ${dimmed ? 'opacity-35' : ''}`}
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/25 font-display text-lg font-bold">
                      {correct ? '✓' : style.letter}
                    </span>
                    <span className="font-display text-xl leading-tight font-bold break-words">{option.text}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {open && (
          <p className="text-center font-display text-xl font-bold tabular-nums">
            {answers.data ?? 0} / {guests} han respost
          </p>
        )}
        {status === 'closed' && <p className="text-center font-bold text-ink-soft">⏰ Temps! Revela la resposta.</p>}

        {error && <p className="text-center font-bold text-tomato">{error}</p>}

        <div className="flex flex-wrap justify-center gap-3">
          {!current && (
            <Button size="lg" variant="secondary" loading={busy === `open:${list[0].id}`} onClick={() => openQuestion(list[0].id)}>
              ▶️ Començar el quiz
            </Button>
          )}
          {open && (
            <Button size="lg" variant="danger" loading={busy === 'close'} onClick={closeNow}>
              ⏹ Tancar ara
            </Button>
          )}
          {status === 'closed' && (
            <Button size="lg" variant="secondary" loading={busy === 'reveal'} onClick={reveal}>
              👀 Revelar resposta
            </Button>
          )}
          {lastRevealed && !podiumOn && (
            <Button size="lg" variant="secondary" loading={busy === 'podium'} onClick={() => void setQuizPodium(true)}>
              🏁 Mostrar podi a tothom
            </Button>
          )}
          {status === 'revealed' && next && (
            <Button size="lg" variant="secondary" loading={busy === `open:${next.id}`} onClick={() => openQuestion(next.id)}>
              ▶️ Següent pregunta
            </Button>
          )}
        </div>
      </Card>

      {podiumOn && ranking.data && (
        <Card tone="party" className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold">🏁 Podi del quiz</h2>
            <p>Ara el veuen tots als mòbils. Quan vulgues, passa a 🏃 Proves.</p>
          </div>
          <Podium ranks={ranking.data} />
        </Card>
      )}

      {status === 'revealed' && ranking.data && (
        <section className="mt-4 flex flex-col gap-3">
          <h2 className="text-xl font-bold">Rànquing del quiz</h2>
          <Ranking ranks={ranking.data} limit={podiumOn ? ranking.data.length : 5} />
        </section>
      )}

      {/* Rescue: jump to any question (e.g. one was skipped by mistake). */}
      <details className="rounded-3xl bg-paper p-4 shadow-card">
        <summary className="cursor-pointer font-bold">🛟 Rescat: saltar a una pregunta</summary>
        <p className="mt-2 text-sm text-ink-soft">
          Només si alguna cosa ha sortit malament. Qui ja ha respost una pregunta no la pot tornar a respondre.
        </p>
        <ol className="mt-3 flex flex-col divide-y divide-line">
          {list.map((q, i) => (
            <li key={q.id} className="flex items-center gap-3 py-2">
              <span className="w-6 text-right font-bold text-ink-soft tabular-nums">{i + 1}</span>
              <span className={`min-w-0 flex-1 truncate ${q.id === questionId ? 'font-bold' : ''}`}>{q.text}</span>
              <Button
                variant="ghost"
                className="px-3! py-1! text-sm"
                disabled={open || busy !== null}
                loading={busy === `open:${q.id}`}
                onClick={() => openQuestion(q.id)}
              >
                Obrir
              </Button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
