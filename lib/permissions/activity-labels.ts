/** Actions connues (voir App\Support\ActivityLogger côté backend) → clé team.activityAction.*. Fallback : la valeur brute (i18n:allow — identifiant technique, pas un texte UI rédigé). */
const KNOWN_ACTIONS = new Set([
  'operation.deleted',
  'operation.restored',
  'team.member_login',
  'variation.price_changed',
  'transaction.deleted',
  'transaction.restored',
  'article.price_changed',
  'team.person_added',
  'team.person_updated',
  'team.access_granted',
  'team.member_suspended',
  'team.member_reactivated',
  'team.member_code_reset',
  'team.person_removed',
])

export function activityActionLabelKey(action: string): string | null {
  return KNOWN_ACTIONS.has(action) ? `team.activityAction.${action}` : null
}
