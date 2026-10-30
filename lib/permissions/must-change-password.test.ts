import { describe, expect, test } from 'vitest'

import { CHANGE_PASSWORD_ROUTE, mustChangePasswordRedirect } from './must-change-password'

describe('mustChangePasswordRedirect — code temporaire jamais remplacé', () => {
  test.each(['/dashboard', '/wallet/new', '/my-sales', '/products', '/settings', '/team'])(
    '%s redirige vers /change-password',
    (pathname) => {
      expect(mustChangePasswordRedirect({ must_change_password: true }, pathname)).toBe(CHANGE_PASSWORD_ROUTE)
    }
  )

  test('déjà sur /change-password : pas de redirection (pas de boucle)', () => {
    expect(mustChangePasswordRedirect({ must_change_password: true }, CHANGE_PASSWORD_ROUTE)).toBeNull()
  })

  test('code déjà changé ou propriétaire : aucune redirection', () => {
    expect(mustChangePasswordRedirect({ must_change_password: false }, '/dashboard')).toBeNull()
    expect(mustChangePasswordRedirect({}, '/dashboard')).toBeNull()
    expect(mustChangePasswordRedirect(null, '/dashboard')).toBeNull()
  })
})
