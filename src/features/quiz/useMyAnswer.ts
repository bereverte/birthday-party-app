import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

export type MyAnswer = {
  optionId: string | null
  // Points for this question; null until close_question has scored it
  // (and stays null for a wrong answer: those get no ledger row).
  points: number | null
}

// My answer to a question and the points it earned. RLS only returns my own
// answer; points_ledger events arrive when close_question scores everyone.
export function useMyAnswer(questionId: string | null, playerId: string) {
  return useKeyedRefetch({
    name: 'quiz_my_answer',
    tables: ['quiz_answers', 'points_ledger'],
    key: questionId,
    fetcher: async (id): Promise<MyAnswer> => {
      const [answer, points] = await Promise.all([
        supabase
          .from('quiz_answers')
          .select('option_id')
          .eq('question_id', id)
          .eq('player_id', playerId)
          .maybeSingle(),
        supabase
          .from('points_ledger')
          .select('points')
          .eq('source_type', 'quiz')
          .eq('source_id', id)
          .eq('player_id', playerId)
          .maybeSingle(),
      ])
      if (answer.error) throw answer.error
      if (points.error) throw points.error
      return { optionId: answer.data?.option_id ?? null, points: points.data?.points ?? null }
    },
  })
}
