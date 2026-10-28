import { describe, expect, test } from 'vitest'
import { PAYMENT_METHOD_ORDER, PAYMENT_METHODS, paymentMethodMeta, toPaymentMethod } from './methods'
import fr from '@/messages/fr/wallet.json'
import en from '@/messages/en/wallet.json'

function resolveKey(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return (acc as Record<string, unknown>)[part]
    return undefined
  }, messages)
}

describe('registre des moyens de paiement', () => {
  test('chaque méthode a un nom, une icône et une couleur hex valide', () => {
    for (const id of PAYMENT_METHOD_ORDER) {
      const meta = PAYMENT_METHODS[id]
      expect(meta.Icon).toBeDefined()
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      if (meta.colorDark) expect(meta.colorDark).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  test('chaque labelKey existe en fr ET en', () => {
    for (const id of PAYMENT_METHOD_ORDER) {
      const key = PAYMENT_METHODS[id].labelKey
      // labelKey est "wallet.xxx" — on retire le domaine "wallet." déjà
      // présent dans le fichier de messages importé.
      const subKey = key.replace(/^wallet\./, '')
      expect(resolveKey(fr, subKey), `fr manque la clé ${key}`).toBeTypeOf('string')
      expect(resolveKey(en, subKey), `en manque la clé ${key}`).toBeTypeOf('string')
    }
  })

  test('non_precise est hachuré, les autres non', () => {
    expect(PAYMENT_METHODS.non_precise.hatched).toBe(true)
    expect(PAYMENT_METHODS.especes.hatched).toBeUndefined()
  })

  test('toPaymentMethod retombe sur non_precise pour une valeur nulle ou inconnue', () => {
    expect(toPaymentMethod(null)).toBe('non_precise')
    expect(toPaymentMethod(undefined)).toBe('non_precise')
    expect(toPaymentMethod('bitcoin')).toBe('non_precise')
    expect(toPaymentMethod('wave')).toBe('wave')
  })

  test('paymentMethodMeta renvoie la bonne entrée du registre', () => {
    expect(paymentMethodMeta('especes').id).toBe('especes')
    expect(paymentMethodMeta(null).id).toBe('non_precise')
  })
})
