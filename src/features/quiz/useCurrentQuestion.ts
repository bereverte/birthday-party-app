import type { PartyState } from '../../hooks/usePartyState'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

export type QuizOption = Tables<'quiz_options'>
export type QuestionKind = 'single' | 'multi' | 'number'
export type CurrentQuestion = {
  question: Tables<'quiz_questions'> & { kind: QuestionKind }
  options: QuizOption[]
  // Empty / null until the reveal for guests (RLS hides the keys), always
  // set for the host. Several ids for a multi question.
  correctOptionIds: string[]
  correctNumber: number | null
}

// True once the answer has arrived: the reveal screen waits for it, so it
// never shows "wrong!" from a read made just before the reveal.
export function hasKey(data: CurrentQuestion) {
  return data.question.kind === 'number' ? data.correctNumber !== null : data.correctOptionIds.length > 0
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
      const [question, options, keys, numberKey] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('id', id).single(),
        supabase.from('quiz_options').select('*').eq('question_id', id).order('position'),
        supabase.from('quiz_keys').select('correct_option_id').eq('question_id', id),
        supabase.from('quiz_number_keys').select('value').eq('question_id', id).maybeSingle(),
      ])
      if (question.error) throw question.error
      if (options.error) throw options.error
      if (keys.error) throw keys.error
      if (numberKey.error) throw numberKey.error
      return {
        question: { ...question.data, kind: question.data.kind as QuestionKind },
        options: options.data,
        correctOptionIds: keys.data.map((r) => r.correct_option_id),
        correctNumber: numberKey.data?.value ?? null,
      }
    },
  })
}
