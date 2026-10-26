/**
 * Logique pure côté client pour la barre de recherche du Portefeuille — pas
 * d'accès réseau, testable indépendamment de React. Miroir LÉGER du
 * reconnaisseur de dates/montants côté backend
 * (app/Services/TransactionSearchParser.php) : ici, sert uniquement à
 * décider si une recherche de moins de 2 caractères doit quand même être
 * lancée (ex. un montant à 2 chiffres n'existe pas vraiment, mais on reste
 * cohérent avec la règle "dès qu'une date ou un montant est reconnu").
 */

const DATE_LIKE = /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/
const ISO_DATE_LIKE = /^\d{4}-\d{1,2}-\d{1,2}$/
const AMOUNT_LIKE = /^\d{1,3}([\s.]?\d{3})*$/

/** Est-ce que `q` ressemble à une date reconnaissable (jour/mois[/année])? */
export function looksLikeDate(q: string): boolean {
  const trimmed = q.trim()
  return DATE_LIKE.test(trimmed) || ISO_DATE_LIKE.test(trimmed)
}

/** Est-ce que `q` ressemble à un montant (chiffres groupés par milliers)? */
export function looksLikeAmount(q: string): boolean {
  const trimmed = q.trim()
  if (!AMOUNT_LIKE.test(trimmed)) return false
  return trimmed.replace(/[\s.]/g, '').length >= 3
}

/**
 * Déclenche la recherche à partir de 2 caractères, OU dès qu'une date/un
 * montant est reconnu (même à 1 caractère, même si en pratique une date ou
 * un montant reconnaissable fait toujours ≥ 2 caractères).
 */
export function isSearchableQuery(q: string): boolean {
  const trimmed = q.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length >= 2) return true
  return looksLikeDate(trimmed) || looksLikeAmount(trimmed)
}

export interface HighlightSegment {
  text: string
  matched: boolean
}

/**
 * Découpe `text` en segments matched/non-matched pour surligner `query`
 * (chaque mot de `query`), insensible à la casse. Pure, utilisée par le
 * composant de surlignage des résultats de recherche.
 */
export function splitForHighlight(text: string, query: string): HighlightSegment[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length === 0) {
    return [{ text, matched: false }]
  }

  const pattern = new RegExp('(' + words.map(escapeRegExp).join('|') + ')', 'gi')
  const parts = text.split(pattern)

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      matched: words.some((w) => w.toLowerCase() === part.toLowerCase()),
    }))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
