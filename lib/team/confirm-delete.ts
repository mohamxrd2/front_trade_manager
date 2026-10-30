/**
 * Suppression définitive d'un membre : il faut retaper son nom. Comparaison
 * tolérante (casse, accents, espaces multiples) — le but est d'empêcher un
 * clic machinal, pas de piéger sur une majuscule.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isDeleteConfirmationValid(typed: string, memberName: string): boolean {
  const expected = normalize(memberName)
  return expected !== '' && normalize(typed) === expected
}
