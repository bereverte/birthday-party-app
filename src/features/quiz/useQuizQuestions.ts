import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type HostQuestion = Tables<'quiz_questions'> & {
  options: Tables<'quiz_options'>[]
  correctOptionId: string | null
}

// Host only: every question, in order, with its options and key (RLS shows
// the host everything). Content is loaded by hand before the party, so
// there's no table to listen to; party_state events and resync keep it fresh.
export function useQuizQuestions(enabled = true) {
  return useRealtimeRefetch({
    name: 'quiz_questions',
    tables: ['party_state'],
    enabled,
    fetcher: async (): Promise<HostQuestion[]> => {
      const [questions, options, keys] = await Promise.all([
        supabase.from('quiz_questions').select('*').order('position'),
        supabase.from('quiz_options').select('*').order('position'),
        supabase.from('quiz_keys').select('*'),
      ])
      if (questions.error) throw questions.error
      if (options.error) throw options.error
      if (keys.error) throw keys.error
      const keyByQuestion = new Map(keys.data.map((k) => [k.question_id, k.correct_option_id]))
      return questions.data.map((q) => ({
        ...q,
        options: options.data.filter((o) => o.question_id === q.id),
        correctOptionId: keyByQuestion.get(q.id) ?? null,
      }))
    },
  })
}
