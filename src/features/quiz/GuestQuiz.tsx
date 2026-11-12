import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { TextInput } from '../../components/ui/TextInput'
import { StatusPill } from '../../components/ui/StatusPill'
import type { PartyState } from '../../hooks/usePartyState'
import type { Player } from '../../hooks/usePlayers'
import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { CountdownBadge } from './CountdownBadge'
import { NumberPicker } from './NumberPicker'
import { optionStyle } from './optionStyles'
import { Podium } from '../leaderboard/Podium'
import { PositionCard } from '../leaderboard/PositionCard'
import { Ranking } from '../leaderboard/Ranking'
import { multiFraction, textCredit } from './scoring'
import { useAutoCloseQuestion } from './useAutoCloseQuestion'
import { useCountdown } from './useCountdown'
import { hasKey, mainTextAnswer, useCurrentQuestion, type CurrentQuestion } from './useCurrentQuestion'
import { useMyAnswer } from './useMyAnswer'
import { useQuizLeaderboard } from './useQuizLeaderboard'

type Props = {
  me: Player
  party: PartyState
  status: RealtimeStatus
  refetchParty: () => void
}

// What I sent, shown while the RPC is on its way (and before the refetch).
type Answer = { optionIds: string[]; numberValue: number | null; textValue: string | null }
type Sent = Answer & { questionId: string }
// What I'm composing on a multi or number question, before "Confirmar".
type Draft = { questionId: string; optionIds: string[]; numberValue: number; textValue: string }

// The guest's quiz: waiting → question open → answered / time up → reveal
// with points and ranking. Everything is derived from party_state and the
// database, so closing the tab and coming back lands on the same screen
// (only an unconfirmed multi/number draft is lost).
export function GuestQuiz({ me, party, status, refetchParty }: Props) {
  const current = useCurrentQuestion(party)
  const questionId = current.data?.question.id ?? null
  const answer = useMyAnswer(questionId, me.id)
  const ranking = useQuizLeaderboard()

  const open = party.question_status === 'open'
  const seconds = useCountdown(party.question_closes_at, open)
  useAutoCloseQuestion(party, refetchParty)

  const [sent, setSent] = useState<Sent | null>(null)
  const [draftState, setDraft] = useState<Draft | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (!current.data || !questionId) {
    return (
      <Screen>
        {header}
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-xl font-semibold">
            {current.error ? friendlyError(current.error) : 'Carregant la pregunta…'}
          </p>
        </div>
      </Screen>
    )
  }

  const data = current.data
  const kind = data.question.kind
  const mySent = sent?.questionId === questionId ? sent : null
  const answered = !!answer.data?.answered || !!mySent
  const myOptionIds = answer.data?.answered ? answer.data.optionIds : (mySent?.optionIds ?? [])
  const myNumber = answer.data?.answered ? answer.data.numberValue : (mySent?.numberValue ?? null)
  const myText = answer.data?.answered ? answer.data.textValue : (mySent?.textValue ?? null)
  const draft =
    draftState?.questionId === questionId ? draftState : { questionId, optionIds: [], numberValue: 0, textValue: '' }

  // Wait for the answer too: right after the reveal the data may still be
  // the pre-reveal read, and "wrong!" must never flash.
  const revealed = party.question_status === 'revealed' && hasKey(data)
  const timeUp = !open || seconds === 0
  const locked = answered || timeUp || sending

  async function send({ optionIds, numberValue, textValue }: Answer) {
    if (!questionId || locked) return
    setSent({ questionId, optionIds, numberValue, textValue })
    setSending(true)
    setError(null)
    const { error: rpcError } =
      kind === 'single'
        ? await supabase.rpc('submit_answer', { p_question_id: questionId, p_option_id: optionIds[0] })
        : kind === 'multi'
          ? await supabase.rpc('submit_multi_answer', { p_question_id: questionId, p_option_ids: optionIds })
          : kind === 'number'
            ? await supabase.rpc('submit_number_answer', { p_question_id: questionId, p_value: numberValue ?? 0 })
            : await supabase.rpc('submit_text_answer', { p_question_id: questionId, p_text: textValue ?? '' })
    setSending(false)
    if (rpcError) {
      setSent(null)
      setError(friendlyError(rpcError))
    }
    void answer.refetch()
  }

  function toggle(optionId: string) {
    if (locked) return
    if (kind === 'single') return void send({ optionIds: [optionId], numberValue: null, textValue: null })
    const ids = draft.optionIds.includes(optionId)
      ? draft.optionIds.filter((id) => id !== optionId)
      : [...draft.optionIds, optionId]
    setDraft({ ...draft, optionIds: ids })
  }

  // Options highlighted as "mine": what I sent, or my draft while composing.
  const marked = answered ? myOptionIds : draft.optionIds

  return (
    <Screen>
      {header}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-soft">Pregunta {data.question.position}</p>
          <h1 className="text-3xl leading-tight font-bold break-words">{data.question.text}</h1>
        </div>
        {open && <CountdownBadge seconds={seconds} />}
      </div>

      {data.question.image_url && (
        <img src={data.question.image_url} alt="" className="max-h-60 w-full rounded-3xl object-cover shadow-card" />
      )}

      {revealed && answer.data && (
        <RevealCard
          data={data}
          optionIds={myOptionIds}
          numberValue={myNumber}
          textValue={myText}
          points={answer.data.points}
        />
      )}

      {revealed && data.revealImageUrl && (
        <img src={data.revealImageUrl} alt="" className="max-h-72 w-full animate-pop rounded-3xl object-cover shadow-card" />
      )}

      {kind === 'multi' && !answered && !timeUp && (
        <p className="-mb-3 text-center font-bold text-lilac">☑️ Pots marcar-ne més d’una</p>
      )}

      {kind === 'text' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.textValue.trim()) void send({ optionIds: [], numberValue: null, textValue: draft.textValue })
          }}
        >
          <TextInput
            label="La teua resposta"
            value={answered ? (myText ?? '') : draft.textValue}
            onChange={(e) => setDraft({ ...draft, textValue: e.target.value })}
            disabled={locked}
            maxLength={60}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="Escriu-la ací"
          />
        </form>
      ) : kind === 'number' ? (
        <NumberPicker
          value={answered ? (myNumber ?? 0) : draft.numberValue}
          max={data.question.number_max ?? 10}
          disabled={locked}
          onChange={(n) => setDraft({ ...draft, numberValue: n })}
        />
      ) : (
        <Options
          data={data}
          marked={marked}
          answered={answered}
          revealed={revealed}
          disabled={locked}
          onToggle={toggle}
        />
      )}

      {kind !== 'single' && !answered && !timeUp && (
        <Button
          size="lg"
          loading={sending}
          disabled={
            (kind === 'multi' && draft.optionIds.length === 0) || (kind === 'text' && !draft.textValue.trim())
          }
          onClick={() =>
            void send({
              optionIds: draft.optionIds,
              numberValue: kind === 'number' ? draft.numberValue : null,
              textValue: kind === 'text' ? draft.textValue : null,
            })
          }
        >
          Confirmar
        </Button>
      )}

      {error && <p className="text-center font-bold text-tomato">{error}</p>}

      {!revealed && <StatusLine kind={kind} answered={answered} timeUp={timeUp} />}

      {revealed && ranking.data && data.isLast && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold">🏁 Rànquing del quiz</h2>
            <p className="text-ink-soft">Aquests punts se sumen a les proves i al show per al rànquing general 🏆</p>
          </div>
          <Podium ranks={ranking.data} />
          <Ranking ranks={ranking.data} limit={ranking.data.length} meId={me.id} />
        </section>
      )}

      {revealed && ranking.data && !data.isLast && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Rànquing del quiz</h2>
          <PositionCard ranks={ranking.data} meId={me.id} />
        </section>
      )}
    </Screen>
  )
}

function Options({
  data,
  marked,
  answered,
  revealed,
  disabled,
  onToggle,
}: {
  data: CurrentQuestion
  marked: string[]
  answered: boolean
  revealed: boolean
  disabled: boolean
  onToggle: (optionId: string) => void
}) {
  const multi = data.question.kind === 'multi'
  return (
    <div className="grid grid-cols-1 gap-3">
      {data.options.map((option, i) => {
        const style = optionStyle(i)
        const mine = marked.includes(option.id)
        const correct = revealed && data.correctOptionIds.includes(option.id)
        // Before the reveal, once sent: dim what I didn't pick. After: dim the wrong ones.
        const dimmed = revealed ? !correct : answered && !mine
        const lifted = mine && !revealed
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(option.id)}
            aria-pressed={mine}
            className={`flex min-h-16 items-center gap-3 rounded-3xl px-4 py-3 text-left text-white shadow-card transition duration-150 active:scale-[0.98] disabled:active:scale-100 ${style.bg} ${dimmed ? 'opacity-35' : ''} ${lifted ? 'scale-[1.02] shadow-lift' : ''}`}
          >
            <span
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ${multi && mine && !revealed ? 'bg-white text-ink' : 'bg-white/25'}`}
            >
              {correct ? '✓' : multi && mine ? '✓' : style.letter}
            </span>
            <span className="min-w-0 flex-1 font-display text-xl leading-tight font-bold break-words">{option.text}</span>
            {mine && (answered || revealed) && (
              <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold">
                {multi ? 'Marcada' : 'La teua'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function StatusLine({ kind, answered, timeUp }: { kind: CurrentQuestion['question']['kind']; answered: boolean; timeUp: boolean }) {
  const prompt =
    kind === 'single'
      ? 'Tria una resposta. Com més ràpid, més punts!'
      : 'Confirma abans que s’acabe el temps. Com més ràpid, més punts!'
  const text = answered
    ? timeUp
      ? 'Temps! Ara veurem si l’has encertada…'
      : 'Resposta enviada ✓ Esperant els altres…'
    : timeUp
      ? '⏰ S’ha acabat el temps!'
      : prompt
  return <p className="text-center font-bold text-ink-soft">{text}</p>
}

// The one loud card on this screen: a full score gets the party card,
// partial credit a sunny one, nothing a plain one.
function RevealCard({
  data,
  optionIds,
  numberValue,
  textValue,
  points,
}: {
  data: CurrentQuestion
  optionIds: string[]
  numberValue: number | null
  textValue: string | null
  points: number | null
}) {
  const kind = data.question.kind
  const answered =
    kind === 'number' ? numberValue !== null : kind === 'text' ? !!textValue : optionIds.length > 0
  const pointsText = points !== null ? `+${points} punts` : null

  let result: { emoji: string; title: string; text: string | null; tone: 'party' | 'sun' | 'paper' }

  if (!answered) {
    result = { emoji: '⏰', title: 'No has respost', text: 'A la pròxima, més ràpid!', tone: 'paper' }
  } else if (kind === 'number') {
    const diff = Math.abs((numberValue ?? 0) - (data.correctNumber ?? 0))
    const close = diff > 0 && diff <= data.question.number_tolerance
    result =
      diff === 0
        ? { emoji: '🎯', title: `Exacte! Era ${data.correctNumber}`, text: pointsText, tone: 'party' }
        : close
          ? {
              emoji: '🤏',
              title: `Per un pèl! Era ${data.correctNumber}`,
              text: `Has dit ${numberValue}. ${pointsText ?? ''}`.trim(),
              tone: 'sun',
            }
          : { emoji: '🙈', title: `Era ${data.correctNumber}`, text: `Has dit ${numberValue}.`, tone: 'paper' }
  } else if (kind === 'text') {
    const credit = textCredit(data.textKeys, textValue ?? '')
    const main = mainTextAnswer(data.textKeys)
    result =
      credit >= 1
        ? { emoji: '🎉', title: `Correcte! Era ${main}`, text: pointsText, tone: 'party' }
        : credit > 0
          ? { emoji: '🤏', title: `Quasi! Era ${main}`, text: pointsText ? `${pointsText} (la meitat)` : null, tone: 'sun' }
          : { emoji: '🙈', title: `Era ${main}`, text: `Has escrit “${textValue}”.`, tone: 'paper' }
  } else if (kind === 'multi') {
    const f = multiFraction(data, optionIds)
    result =
      f >= 1
        ? { emoji: '🎉', title: 'Totes bé!', text: pointsText, tone: 'party' }
        : f > 0
          ? { emoji: '👌', title: 'Gairebé!', text: pointsText, tone: 'sun' }
          : { emoji: '🙈', title: 'Uf, aquesta no ha sumat', text: 'Si marques una falsa, no puntua.', tone: 'paper' }
  } else {
    const right = data.correctOptionIds.includes(optionIds[0])
    result = right
      ? { emoji: '🎉', title: 'Correcte!', text: pointsText, tone: 'party' }
      : { emoji: '🙈', title: 'Uf, no era aquesta', text: 'La pròxima segur que sí.', tone: 'paper' }
  }

  const loud = result.tone === 'party'
  return (
    <Card tone={result.tone} className="flex animate-pop items-center gap-4">
      <span className="text-5xl" aria-hidden>
        {result.emoji}
      </span>
      <div>
        <p className="font-display text-2xl leading-tight font-bold">{result.title}</p>
        {result.text !== null && (
          <p className={loud ? 'text-white' : 'text-ink-soft'}>{result.text || 'Sumant punts…'}</p>
        )}
      </div>
    </Card>
  )
}
