import { describe, expect, test } from 'vitest'
import {
  getTransactionKind,
  getTransactionVisual,
  fundingSourceLabelKey,
  paymentMethodLabelKey,
  paymentMethodIcon,
} from './transaction-visual'

describe('getTransactionKind', () => {
  test.each(['sale', 'expense', 'apport', 'retrait'] as const)('reconnaît %s', (type) => {
    expect(getTransactionKind(type)).toBe(type)
  })

  test('un type inconnu retombe sur "other" (pas de crash)', () => {
    expect(getTransactionKind('un-type-du-futur')).toBe('other')
  })

  test('null/undefined retombent aussi sur "other"', () => {
    expect(getTransactionKind(null)).toBe('other')
    expect(getTransactionKind(undefined)).toBe('other')
  })
})

describe('getTransactionVisual', () => {
  test('vente : signe +, libellé transactions.sale', () => {
    const v = getTransactionVisual('sale')
    expect(v.sign).toBe('+')
    expect(v.labelKey).toBe('transactions.sale')
  })

  test('dépense : signe −, libellé transactions.expense', () => {
    const v = getTransactionVisual('expense')
    expect(v.sign).toBe('−')
    expect(v.labelKey).toBe('transactions.expense')
  })

  test('apport : signe +, couleur indigo (brand-700), jamais la couleur vente (success)', () => {
    const deposit = getTransactionVisual('apport')
    const sale = getTransactionVisual('sale')
    expect(deposit.sign).toBe('+')
    expect(deposit.labelKey).toBe('transactions.deposit')
    expect(deposit.amountClassName).toContain('brand-700')
    expect(deposit.amountClassName).not.toBe(sale.amountClassName)
  })

  test('retrait : signe −, couleur orange (warning), jamais la couleur dépense (danger)', () => {
    const withdrawal = getTransactionVisual('retrait')
    const expense = getTransactionVisual('expense')
    expect(withdrawal.sign).toBe('−')
    expect(withdrawal.labelKey).toBe('transactions.withdrawal')
    expect(withdrawal.amountClassName).toContain('warning')
    expect(withdrawal.amountClassName).not.toBe(expense.amountClassName)
  })

  test('type inconnu : libellé "Opération" (transactions.operation), jamais de crash', () => {
    const other = getTransactionVisual('un-type-du-futur')
    expect(other.labelKey).toBe('transactions.operation')
    expect(other.kind).toBe('other')
    expect(() => other.Icon).not.toThrow()
  })
})

describe('fundingSourceLabelKey', () => {
  test('mappe chaque origine connue vers sa clé de traduction', () => {
    expect(fundingSourceLabelKey('apport_personnel')).toBe('wallet.deposit.fundingSourcePersonal')
    expect(fundingSourceLabelKey('collaborateur')).toBe('wallet.deposit.fundingSourceCollaborator')
    expect(fundingSourceLabelKey('pret')).toBe('wallet.deposit.fundingSourceLoan')
    expect(fundingSourceLabelKey('autre')).toBe('wallet.deposit.fundingSourceOther')
  })

  test('origine inconnue ou absente : null (pas de ligne affichée)', () => {
    expect(fundingSourceLabelKey(null)).toBeNull()
    expect(fundingSourceLabelKey(undefined)).toBeNull()
    expect(fundingSourceLabelKey('inconnu')).toBeNull()
  })
})

describe('paymentMethodLabelKey', () => {
  test('mappe chaque moyen de paiement connu vers sa clé de traduction', () => {
    expect(paymentMethodLabelKey('especes')).toBe('wallet.deposit.paymentMethodCash')
    expect(paymentMethodLabelKey('orange_money')).toBe('wallet.deposit.paymentMethodOrangeMoney')
    expect(paymentMethodLabelKey('moov_money')).toBe('wallet.deposit.paymentMethodMoovMoney')
    expect(paymentMethodLabelKey('wave')).toBe('wallet.deposit.paymentMethodWave')
    expect(paymentMethodLabelKey('mtn_money')).toBe('wallet.deposit.paymentMethodMtnMoney')
    expect(paymentMethodLabelKey('virement')).toBe('wallet.deposit.paymentMethodTransfer')
  })

  test('moyen de paiement inconnu ou absent : null', () => {
    expect(paymentMethodLabelKey(null)).toBeNull()
    expect(paymentMethodLabelKey('inconnu')).toBeNull()
  })
})

describe('paymentMethodIcon', () => {
  test('chacun des 6 moyens de paiement de l\'encaissement a une icône (jamais undefined)', () => {
    const methods = ['especes', 'orange_money', 'moov_money', 'wave', 'mtn_money', 'virement']
    for (const method of methods) {
      expect(paymentMethodIcon(method)).toBeTruthy()
    }
  })

  test('espèces et Wave ont chacun leur propre icône, distincte des opérateurs mobile money', () => {
    const cash = paymentMethodIcon('especes')
    const wave = paymentMethodIcon('wave')
    const orangeMoney = paymentMethodIcon('orange_money')
    expect(cash).not.toBe(wave)
    expect(wave).not.toBe(orangeMoney)
  })

  test('les opérateurs mobile money (Orange/Moov/MTN) partagent la même icône générique', () => {
    expect(paymentMethodIcon('orange_money')).toBe(paymentMethodIcon('moov_money'))
    expect(paymentMethodIcon('moov_money')).toBe(paymentMethodIcon('mtn_money'))
  })

  test('moyen de paiement inconnu ou absent : une icône par défaut, jamais de crash', () => {
    expect(() => paymentMethodIcon(null)).not.toThrow()
    expect(() => paymentMethodIcon('inconnu')).not.toThrow()
    expect(paymentMethodIcon(null)).toBeTruthy()
  })
})
