import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

// Host only: how many guests have answered (RLS shows the host every answer).
// A count query, not the rows: 30 answers in a burst cost ~2 tiny reads.
export function useAnswerCount(questionId: string | null) {
  return useKeyedRefetch({
    name: 'quiz_answer_count',
    tables: ['quiz_answers'],
    key: questionId,
    fetcher: async (id) => {
      const { count, error } = await supabase
        .from('quiz_answers')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', id)
      if (error) throw error
      return count ?? 0
    },
  })
}
