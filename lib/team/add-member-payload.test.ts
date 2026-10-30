import { describe, expect, test } from 'vitest'

import { buildAddTeamMemberPayload } from './add-member-payload'

const cashier = { role: 'cashier', overrides: [] }

describe('buildAddTeamMemberPayload — formulaire « Ajouter une personne »', () => {
  test('associé seul : part envoyée, aucun rôle', () => {
    const payload = buildAddTeamMemberPayload({ name: ' Awa ', phone: '', isPartner: true, share: 25, hasAccess: false }, cashier)
    expect(payload).toMatchObject({ name: 'Awa', phone: null, is_partner: true, share: 25, has_access: false })
    expect(payload.role).toBeUndefined()
    expect(payload.permissions_overrides).toBeUndefined()
  })

  test('accès seul : rôle envoyé, aucune part', () => {
    const payload = buildAddTeamMemberPayload({ name: 'Koffi', phone: '+225 07', isPartner: false, share: 10, hasAccess: true }, cashier)
    expect(payload).toMatchObject({ name: 'Koffi', phone: '+225 07', is_partner: false, has_access: true, role: 'cashier' })
    expect(payload.share).toBeUndefined()
  })

  test('associé ET accès : part et rôle, avec ajustements de permissions', () => {
    const overrides = [{ permission: 'expenses.create', granted: true }]
    const payload = buildAddTeamMemberPayload(
      { name: 'Marc', isPartner: true, share: 10, hasAccess: true },
      { role: 'manager', overrides }
    )
    expect(payload).toMatchObject({ is_partner: true, share: 10, has_access: true, role: 'manager', permissions_overrides: overrides })
  })

  test('jamais d’e-mail : le membre se connecte avec son identifiant', () => {
    const payload = buildAddTeamMemberPayload({ name: 'Koffi', isPartner: false, hasAccess: true }, cashier)
    expect('email' in payload).toBe(false)
  })
})
