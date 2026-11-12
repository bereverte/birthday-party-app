import type { PartyState } from '../../hooks/usePartyState'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

export type QuizOption = Tables<'quiz_options'>
export type QuestionKind = 'single' | 'multi' | 'number' | 'text'
// An accepted written answer: credit 1 = full points, 0.5 = half.
export type TextKey = { answer: string; credit: number }
export type CurrentQuestion = {
  question: Tables<'quiz_questions'> & { kind: QuestionKind }
  options: QuizOption[]
  // Empty / null until the reveal for guests (RLS hides the keys), always
  // set for the host. Several ids for a multi question.
  correctOptionIds: string[]
  correctNumber: number | null
  // Ordered by position: the first full-credit one is "the" answer.
  textKeys: TextKey[]
  // A picture shown only at the reveal (DECISIONS 032).
  revealImageUrl: string | null
  // No question after this one: the guest reveal shows the quiz podium.
  isLast: boolean
}

// True once the answer has arrived: the reveal screen waits for it, so it
// never shows "wrong!" from a read made just before the reveal.
export function hasKey(data: CurrentQuestion) {
  switch (data.question.kind) {
    case 'number':
      return data.correctNumber !== null
    case 'text':
      return data.textKeys.length > 0
    default:
      return data.correctOptionIds.length > 0
  }
}

// The answer to show at the reveal of a text question.
export function mainTextAnswer(keys: TextKey[]) {
  return (keys.find((k) => k.credit >= 1) ?? keys[0])?.answer ?? ''
}

// The question on screen. Its content only changes through party_state
// (open → closed → revealed), so the key is "question + status": the reveal
// refetches and picks up the answer, which RLS only shows from then on.
export function useCurrentQuestion(party: PartyState | undefined) {
  const questionId = party && party.question_status !== 'idle' ? party.current_question_id : null
  const key = questionId ? `${questionId}:${party?.question_status}` : null

  return useKeyedRefetch({
    name: 'quiz_question',
    tables: ['party_state'],
    key,
    // Same question, new status: keep showing it while the refetch runs
    // (no "loading" flash on close or reveal).
    sameData: (a, b) => a.split(':')[0] === b.split(':')[0],
    fetcher: async (k): Promise<CurrentQuestion> => {
      const id = k.split(':')[0]
      const [question, options, keys, numberKey, textKeys, revealImage] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('id', id).single(),
        supabase.from('quiz_options').select('*').eq('question_id', id).order('position'),
        supabase.from('quiz_keys').select('correct_option_id').eq('question_id', id),
        supabase.from('quiz_number_keys').select('value').eq('question_id', id).maybeSingle(),
        supabase.from('quiz_text_keys').select('answer, credit').eq('question_id', id).order('position'),
        supabase.from('quiz_reveal_images').select('image_url').eq('question_id', id).maybeSingle(),
      ])
      if (question.error) throw question.error
      if (options.error) throw options.error
      if (keys.error) throw keys.error
      if (numberKey.error) throw numberKey.error
      if (textKeys.error) throw textKeys.error
      if (revealImage.error) throw revealImage.error
      const later = await supabase
        .from('quiz_questions')
        .select('id')
        .gt('position', question.data.position)
        .limit(1)
      if (later.error) throw later.error
      return {
        question: { ...question.data, kind: question.data.kind as QuestionKind },
        options: options.data,
        correctOptionIds: keys.data.map((r) => r.correct_option_id),
        correctNumber: numberKey.data?.value ?? null,
        textKeys: textKeys.data.map((r) => ({ answer: r.answer, credit: Number(r.credit) })),
        revealImageUrl: revealImage.data?.image_url ?? null,
        isLast: later.data.length === 0,
      }
    },
  })
}
