/**
 * Sous-ensemble minimal d'ICU MessageFormat : uniquement la syntaxe plural,
 * ex. "{count, plural, one {# article} other {# articles}}". Pas de
 * dépendance externe (intl-messageformat) pour un besoin aussi restreint —
 * seules les catégories `one`/`other` sont utilisées par le fr et l'en (les
 * deux seules langues de l'app), `=N {...}` est accepté en plus pour les cas
 * explicites (ex. "=0 {Aucun article}").
 *
 * Parsing manuel (pas une regex globale) car le contenu entre accolades peut
 * lui-même contenir du texte libre — une regex paresseuse/gourmande se
 * trompe dès qu'il y a plus d'un bloc ou des caractères `{`/`}` imprévus.
 */

const PLURAL_OPEN = /\{(\w+)\s*,\s*plural\s*,\s*/

interface PluralBlock {
  start: number
  end: number // index juste après le `}` fermant du bloc entier
  varName: string
  branches: Record<string, string>
}

/**
 * Trouve le premier bloc plural dans `template` à partir de `fromIndex`,
 * en comptant les accolades pour localiser la fin exacte du bloc englobant.
 */
function findPluralBlock(template: string, fromIndex = 0): PluralBlock | null {
  const match = PLURAL_OPEN.exec(template.slice(fromIndex))
  if (!match || match.index === undefined) return null

  const blockStart = fromIndex + match.index
  const varName = match[1]
  let cursor = fromIndex + match.index + match[0].length
  const branches: Record<string, string> = {}

  // `cursor` pointe juste après la virgule qui suit "plural" — on lit une
  // suite de paires "mot-clé { contenu }" jusqu'à l'accolade fermante du
  // bloc plural lui-même.
  let depthOfOuterBlock = 1 // l'accolade ouvrante déjà consommée par PLURAL_OPEN
  while (cursor < template.length && depthOfOuterBlock > 0) {
    // Ignore les espaces entre deux branches.
    while (cursor < template.length && /\s/.test(template[cursor])) cursor++

    if (template[cursor] === '}') {
      // Accolade fermante du bloc plural entier.
      depthOfOuterBlock--
      cursor++
      break
    }

    // Lire le mot-clé (one, other, few, many, zero, =0, =1, …).
    const keywordMatch = /^[=\w]+/.exec(template.slice(cursor))
    if (!keywordMatch) break
    const keyword = keywordMatch[0]
    cursor += keyword.length

    while (cursor < template.length && /\s/.test(template[cursor])) cursor++
    if (template[cursor] !== '{') break
    cursor++ // consomme l'accolade ouvrante de la branche

    let innerDepth = 1
    const contentStart = cursor
    while (cursor < template.length && innerDepth > 0) {
      if (template[cursor] === '{') innerDepth++
      else if (template[cursor] === '}') innerDepth--
      if (innerDepth > 0) cursor++
    }
    branches[keyword] = template.slice(contentStart, cursor)
    cursor++ // consomme l'accolade fermante de la branche
  }

  return { start: blockStart, end: cursor, varName, branches }
}

/**
 * Résout tous les blocs plural d'un template donné. `params` doit contenir
 * une valeur numérique pour chaque `varName` référencé par un bloc plural.
 * `#` dans la branche choisie est remplacé par cette valeur.
 */
export function resolveICUPlural(
  template: string,
  params: Record<string, string | number> | undefined,
  pluralRules: Intl.PluralRules
): string {
  if (!template.includes(', plural,') && !template.includes(',plural,')) return template

  let result = ''
  let cursor = 0

  for (;;) {
    const block = findPluralBlock(template, cursor)
    if (!block) {
      result += template.slice(cursor)
      break
    }

    result += template.slice(cursor, block.start)

    const rawCount = params?.[block.varName]
    const count = typeof rawCount === 'number' ? rawCount : Number(rawCount ?? 0)
    const exactKey = `=${count}`
    const category = pluralRules.select(count)
    const branch = block.branches[exactKey] ?? block.branches[category] ?? block.branches.other ?? ''

    result += branch.replace(/#/g, String(count))
    cursor = block.end
  }

  return result
}
