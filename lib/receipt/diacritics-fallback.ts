/**
 * "Mode compatibilité" — repli pour les imprimantes qui ne reconnaissent
 * pas la page de code CP858 (texte imprimé en points d'interrogation ou en
 * charabia) : remplace chaque lettre accentuée par son équivalent ASCII le
 * plus proche (é→e, ç→c, œ→oe…) plutôt que de risquer un ticket illisible.
 */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/gi, (m) => (m === 'Œ' ? 'OE' : 'oe'))
    .replace(/æ/gi, (m) => (m === 'Æ' ? 'AE' : 'ae'))
}
