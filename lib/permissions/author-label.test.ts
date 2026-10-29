import { describe, expect, test } from 'vitest'
import { translate } from '@/lib/i18n/translate'
import { authorLabel } from './author-label'

const t = (key: string, params?: Record<string, string | number>) => translate(key, 'fr', params)

describe('authorLabel — "par Koffi (Caissier)" (chantier "Équipe" §7)', () => {
  test('membre avec rôle connu', () => {
    expect(authorLabel({ id: 'u1', name: 'Koffi Yao', role: 'cashier' }, t)).toBe('par Koffi Yao (Caissier)')
  })

  test('propriétaire', () => {
    expect(authorLabel({ id: 'owner1', name: 'Awa Diallo', role: 'owner' }, t)).toBe('par Awa Diallo (Propriétaire)')
  })

  test('null/undefined : pas d\'auteur affiché', () => {
    expect(authorLabel(null, t)).toBeNull()
    expect(authorLabel(undefined, t)).toBeNull()
  })

  test('auteur sans nom (non chargé côté serveur) : pas d\'auteur affiché', () => {
    expect(authorLabel({ id: 'u1', name: null, role: 'cashier' }, t)).toBeNull()
  })
})
