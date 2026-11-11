import { supabase } from '../../lib/supabase'
import { useKeyedRefetch } from './useKeyedRefetch'

export type MyAnswer = {
  answered: boolean
  // The options I marked (one for single, any number for multi).
  optionIds: string[]
  numberValue: number | null
  textValue: string | null
  // Points for this question; null until close_question has scored it
  // (and stays null when it scored 0: those get no ledger row).
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
          .select('option_id, option_ids, number_value, text_value')
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
      const a = answer.data
      return {
        answered: !!a,
        optionIds: a?.option_id ? [a.option_id] : (a?.option_ids ?? []),
        numberValue: a?.number_value ?? null,
        textValue: a?.text_value ?? null,
        points: points.data?.points ?? null,
      }
    },
  })
}
