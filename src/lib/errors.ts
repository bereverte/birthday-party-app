// Turns Supabase/RPC errors into friendly Catalan messages for the UI.
// The original message is logged so it can still be debugged.

const known: Array<[RegExp, string]> = [
  [/rate limit|too many requests|429/i, 'Massa gent entrant alhora. Espera uns segons i torna-ho a provar.'],
  [/failed to fetch|networkerror|load failed/i, 'Sembla que no hi ha connexió. Comprova la cobertura i torna-ho a provar.'],
  [/name must be between/i, 'El nom ha de tindre entre 1 i 30 caràcters.'],
  [/not signed in|jwt expired|auth session missing/i, 'La sessió ha caducat. Recarrega la pàgina.'],
  [/only the host/i, 'Només l’amfitriona pot fer això.'],
  [/time is up/i, 'S’ha acabat el temps!'],
  [/already answered/i, 'Ja has respost aquesta pregunta.'],
  [/question is not open/i, 'Aquesta pregunta ja està tancada.'],
  [/host cannot answer/i, 'L’amfitriona no juga el quiz 😉'],
  [/pick at least one option/i, 'Marca almenys una opció.'],
  [/write an answer/i, 'Escriu una resposta.'],
  [/answer too long/i, 'Massa llarga: com a molt 60 caràcters.'],
  [/number out of range/i, 'Aquest número no val.'],
  [/wrong answer type/i, 'Aquesta pregunta ha canviat. Recarrega la pàgina.'],
  [/close the current question first/i, 'Primer tanca la pregunta que està oberta.'],
  [/close the question before revealing/i, 'Primer tanca la pregunta.'],
  [/not in the challenges phase/i, 'Primer posa la fase de proves.'],
  [/challenge not found/i, 'Aquesta prova ja no existeix.'],
  [/select at least one player/i, 'Selecciona almenys un jugador.'],
  [/points must be zero or more/i, 'Els punts han de ser 0 o més.'],
  [/challenges_name_length/i, 'El nom de la prova ha de tindre entre 1 i 40 caràcters.'],
  [/challenges_description_length/i, 'La descripció pot tindre com a molt 200 caràcters.'],
  [/challenges_emoji_length/i, 'Posa un sol emoji.'],
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
