// Turns Supabase/RPC errors into friendly Catalan messages for the UI.
// The original message is logged so it can still be debugged.

const known: Array<[RegExp, string]> = [
  [/rate limit|too many requests|429/i, 'Massa gent entrant alhora. Espera uns segons i torna-ho a provar.'],
  [/failed to fetch|networkerror|load failed/i, 'Sembla que no hi ha connexió. Comprova la cobertura i torna-ho a provar.'],
  [/name must be between/i, 'El nom ha de tindre entre 1 i 30 caràcters.'],
  [/not signed in|jwt expired|auth session missing/i, 'La sessió ha caducat. Recarrega la pàgina.'],
  [/only the host/i, 'Només l’amfitriona pot fer això.'],
  [/invalid email|unable to validate email/i, 'Aquest correu no sembla vàlid.'],
]

export function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error)

  console.error(error)

  for (const [pattern, friendly] of known) {
    if (pattern.test(message)) return friendly
  }
  return 'Alguna cosa no ha anat bé. Torna-ho a provar.'
}
