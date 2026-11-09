import type { CurrentQuestion } from './useCurrentQuestion'

// Display only: picks the reveal message ("Totes bé!" / "Gairebé!").
// The points themselves are computed by close_question (DECISIONS 031),
// with the same rule: any wrong mark scores 0, otherwise the share of the
// correct options that were marked.
export function multiFraction(data: CurrentQuestion, marked: string[]) {
  const correct = new Set(data.correctOptionIds)
  if (correct.size === 0 || marked.some((id) => !correct.has(id))) return 0
  return marked.length / correct.size
}
