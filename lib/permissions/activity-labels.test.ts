import { describe, expect, test } from 'vitest'

import { translate } from '@/lib/i18n/translate'
import { describeActivity } from './activity-labels'

const MEMBER = 'koffi'
const OWNER = 'awa'
const t = (key: string, params?: Record<string, string | number>) => translate(key, 'fr', params)
const money = (v: number) => `${v} F`

function entry(over: Partial<Parameters<typeof describeActivity>[0]>) {
  return { action: 'team.member_login', user_id: MEMBER, subject_id: null, details: null, actor_name: 'Koffi Yao', subject_name: null, ...over }
}

describe('describeActivity — phrases du journal d’un membre', () => {
  test('jamais la clé brute : chaque action connue se traduit, en fr ET en en', () => {
    const actions = [
      'team.member_login', 'operation.deleted', 'operation.restored', 'transaction.deleted', 'transaction.restored',
      'article.price_changed', 'variation.price_changed', 'team.person_added', 'team.person_updated',
      'team.access_granted', 'team.member_suspended', 'team.member_reactivated', 'team.member_code_reset',
      'team.person_removed', 'team.member_deleted',
    ]
    for (const language of ['fr', 'en'] as const) {
      const tl = (key: string, params?: Record<string, string | number>) => translate(key, language, params)
      for (const action of actions) {
        const done = describeActivity(entry({ action, subject_name: 'X' }), MEMBER, tl, money)
        expect(done).not.toContain('team.activity')
        const received = describeActivity(entry({ action, user_id: OWNER, subject_id: MEMBER, actor_name: 'Awa' }), MEMBER, tl, money)
        expect(received).not.toContain('team.activity')
      }
    }
  })

  test('ce que le membre a fait', () => {
    expect(describeActivity(entry({}), MEMBER, t, money)).toBe('Connexion à l’application')
    expect(describeActivity(entry({ action: 'operation.deleted', subject_name: 'V-261030-0002' }), MEMBER, t, money)).toBe(
      'A annulé l’opération V-261030-0002'
    )
    expect(
      describeActivity(entry({ action: 'article.price_changed', subject_name: 'Robe wax', details: { from: 5000, to: 6000 } }), MEMBER, t, money)
    ).toBe('A changé le prix de Robe wax : 5000 F → 6000 F')
  })

  test('ce qu’on a fait au membre : « … par Awa »', () => {
    expect(
      describeActivity(entry({ action: 'team.member_suspended', user_id: OWNER, subject_id: MEMBER, actor_name: 'Awa' }), MEMBER, t, money)
    ).toBe('Suspension par Awa')
  })

  test('le propriétaire qui suspend quelqu’un : « A suspendu Koffi » (et non « Suspendu »)', () => {
    expect(
      describeActivity(entry({ action: 'team.member_suspended', user_id: OWNER, subject_id: MEMBER, actor_name: 'Awa', subject_name: 'Koffi' }), OWNER, t, money)
    ).toBe('A suspendu Koffi')
  })

  test('action inconnue : libellé générique, jamais une clé de traduction', () => {
    expect(describeActivity(entry({ action: 'something.new' }), MEMBER, t, money)).toBe('Autre action (something.new)')
  })
})
