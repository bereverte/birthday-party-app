import type { CurrentQuestion, TextKey } from './useCurrentQuestion'

// Display only: these pick the reveal message ("Totes bé!" / "Quasi!").
// The points themselves are computed by close_question on the server
// (DECISIONS 031, 032) with the same rules.

// Multi: any wrong mark scores 0, otherwise the share of the correct
// options that were marked.
export function multiFraction(data: CurrentQuestion, marked: string[]) {
  const correct = new Set(data.correctOptionIds)
  if (correct.size === 0 || marked.some((id) => !correct.has(id))) return 0
  return marked.length / correct.size
}

// Same as public.normalize_answer: lower case, no accents, only letters
// and digits. " Nuc. " → "nuc".
export function normalizeAnswer(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Text: the best credit among the accepted answers that match (0 if none).
export function textCredit(keys: TextKey[], written: string) {
  const mine = normalizeAnswer(written)
  return keys.reduce((best, k) => (normalizeAnswer(k.answer) === mine ? Math.max(best, k.credit) : best), 0)
}
