// A question ending in "(...)" shows that part as a smaller aside,
// e.g. "Quin repte té per a l’abril? (no m’ho gafeu 🤞)".
export function QuestionText({ text }: { text: string }) {
  const match = /^(.*\S)\s*(\([^()]*\))$/s.exec(text)
  if (!match) return text
  return (
    <>
      {match[1]} <span className="text-base font-normal whitespace-nowrap opacity-70">{match[2]}</span>
    </>
  )
}
