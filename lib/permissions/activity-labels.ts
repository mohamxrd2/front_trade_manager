import type { ActivityLogEntry } from '@/lib/services/team'

type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * Actions connues du journal (App\Support\ActivityLogger côté backend). Les
 * clés de traduction remplacent les points par des « _ » : la recherche de
 * traduction coupe la clé sur chaque point, `team.activity.done.team.member_login`
 * ne se résoudrait jamais (la clé brute s'affichait à l'écran).
 */
const KNOWN_ACTIONS = new Set([
  'team.member_login',
  'operation.deleted',
  'operation.restored',
  'transaction.deleted',
  'transaction.restored',
  'article.price_changed',
  'variation.price_changed',
  'team.person_added',
  'team.person_updated',
  'team.access_granted',
  'team.member_suspended',
  'team.member_reactivated',
  'team.member_code_reset',
  'team.person_removed',
  'team.member_deleted',
])

/** Actions dont la personne affichée peut être le SUJET (« Suspension par Awa »). */
const RECEIVED_ACTIONS = new Set([
  'team.person_added',
  'team.person_updated',
  'team.access_granted',
  'team.member_suspended',
  'team.member_reactivated',
  'team.member_code_reset',
  'team.person_removed',
])

export function activityKeySegment(action: string): string {
  return action.replace(/\./g, '_')
}

/**
 * Phrase affichée pour une entrée de l'activité de `memberId` : ce qu'il a
 * fait (« A suspendu Koffi ») ou ce qu'on lui a fait (« Suspension par
 * Awa »). `formatAmount` formate les prix (changement de prix).
 */
export function describeActivity(
  entry: Pick<ActivityLogEntry, 'action' | 'user_id' | 'subject_id' | 'details' | 'actor_name' | 'subject_name'>,
  memberId: string,
  t: Translate,
  formatAmount: (value: number) => string
): string {
  if (!KNOWN_ACTIONS.has(entry.action)) {
    return t('team.activity.unknown', { action: entry.action })
  }

  const segment = activityKeySegment(entry.action)
  const someone = t('team.activity.someone')
  const isReceived = entry.user_id !== memberId && entry.subject_id === memberId && RECEIVED_ACTIONS.has(entry.action)

  if (isReceived) {
    return t(`team.activity.received.${segment}`, { actor: entry.actor_name ?? someone })
  }

  const details = entry.details ?? {}
  const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(v))
  return t(`team.activity.done.${segment}`, {
    subject: entry.subject_name ?? someone,
    from: details.from !== undefined && details.from !== null ? formatAmount(toNumber(details.from)) : '—',
    to: details.to !== undefined && details.to !== null ? formatAmount(toNumber(details.to)) : '—',
  })
}
