import type { CurrentQuestion } from './useCurrentQuestion'

// Display only: picks the reveal message ("Totes bé!" / "Gairebé!").
// The points themselves are computed by close_question (DECISIONS 031),
// with the same formula: marked correct / all correct − marked wrong / all wrong, min 0.
export function multiFraction(data: CurrentQuestion, marked: string[]) {
  const correct = new Set(data.correctOptionIds)
  const allCorrect = correct.size
  const allWrong = data.options.length - allCorrect
  const markedCorrect = marked.filter((id) => correct.has(id)).length
  const markedWrong = marked.length - markedCorrect
  const good = allCorrect > 0 ? markedCorrect / allCorrect : 0
  const bad = allWrong > 0 ? markedWrong / allWrong : 0
  return Math.max(0, good - bad)
}
