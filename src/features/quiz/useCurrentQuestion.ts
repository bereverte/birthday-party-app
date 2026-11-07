import type { PartyState } from '../../hooks/usePartyState'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

export type QuizOption = Tables<'quiz_options'>
export type CurrentQuestion = {
  question: Tables<'quiz_questions'>
  options: QuizOption[]
  // null until the reveal for guests (RLS hides quiz_keys), always set for the host.
  correctOptionId: string | null
}

// The question on screen. Its content only changes through party_state
// (open → closed → revealed), so the key is "question + status": the reveal
// refetches and picks up the correct option, which RLS only shows from then on.
export function useCurrentQuestion(party: PartyState | undefined) {
  const questionId = party && party.question_status !== 'idle' ? party.current_question_id : null
  const key = questionId ? `${questionId}:${party?.question_status}` : null

  return useKeyedRefetch({
    name: 'quiz_question',
    tables: ['party_state'],
    key,
    fetcher: async (k): Promise<CurrentQuestion> => {
      const id = k.split(':')[0]
      const [question, options, keyRow] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('id', id).single(),
        supabase.from('quiz_options').select('*').eq('question_id', id).order('position'),
        supabase.from('quiz_keys').select('correct_option_id').eq('question_id', id).maybeSingle(),
      ])
      if (question.error) throw question.error
      if (options.error) throw options.error
      if (keyRow.error) throw keyRow.error
      return {
        question: question.data,
        options: options.data,
        correctOptionId: keyRow.data?.correct_option_id ?? null,
      }
    },
  })
}
