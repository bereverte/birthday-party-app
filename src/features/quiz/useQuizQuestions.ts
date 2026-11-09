import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { QuestionKind } from './useCurrentQuestion'

export type HostQuestion = Tables<'quiz_questions'> & {
  kind: QuestionKind
  options: Tables<'quiz_options'>[]
  correctOptionIds: string[]
  correctNumber: number | null
}

// Host only: every question, in order, with its options and answers (RLS
// shows the host everything). Content is loaded by hand before the party,
// so there's no table to listen to; party_state events and resync keep it fresh.
export function useQuizQuestions(enabled = true) {
  return useRealtimeRefetch({
    name: 'quiz_questions',
    tables: ['party_state'],
    enabled,
    fetcher: async (): Promise<HostQuestion[]> => {
      const [questions, options, keys, numberKeys] = await Promise.all([
        supabase.from('quiz_questions').select('*').order('position'),
        supabase.from('quiz_options').select('*').order('position'),
        supabase.from('quiz_keys').select('*'),
        supabase.from('quiz_number_keys').select('*'),
      ])
      if (questions.error) throw questions.error
      if (options.error) throw options.error
      if (keys.error) throw keys.error
      if (numberKeys.error) throw numberKeys.error
      const numberByQuestion = new Map(numberKeys.data.map((k) => [k.question_id, k.value]))
      return questions.data.map((q) => ({
        ...q,
        kind: q.kind as QuestionKind,
        options: options.data.filter((o) => o.question_id === q.id),
        correctOptionIds: keys.data.filter((k) => k.question_id === q.id).map((k) => k.correct_option_id),
        correctNumber: numberByQuestion.get(q.id) ?? null,
      }))
    },
  })
}
