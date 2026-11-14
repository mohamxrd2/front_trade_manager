/**
 * En-têtes que le front ajoute aux requêtes vers l'API. Le backend doit
 * TOUS les autoriser (config/cors.php, allowed_headers) : sinon le
 * navigateur bloque la requête avant même qu'elle parte, et l'utilisateur
 * voit une erreur réseau. lib/api-headers.test.ts vérifie que chaque
 * en-tête posé dans le code figure ici, et qu'il est autorisé côté backend.
 */
export const API_REQUEST_HEADERS = [
  'Accept',
  'Accept-Language',
  'Content-Type',
  'X-Requested-With',
  'X-XSRF-TOKEN',
  'X-Account-Id',
  'Idempotency-Key',
  'X-Request-Id',
] as const

export type ApiRequestHeader = (typeof API_REQUEST_HEADERS)[number]
