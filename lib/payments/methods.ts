import { Banknote, Building2, CircleHelp, MoreHorizontal, Smartphone, Zap, type LucideIcon } from 'lucide-react'

/**
 * Source UNIQUE nom/icône/couleur pour un moyen de paiement — réutilisée
 * partout où un moyen de paiement est affiché (puces de l'encaissement,
 * ticket de caisse, liste des opérations, et les nouvelles sections
 * "stats-paiements" : donut, tableau, graphique d'évolution). Les couleurs
 * sont FIXES et ne doivent jamais être recalculées ailleurs — une couleur
 * n'est jamais affichée seule, toujours accompagnée du nom et de l'icône
 * (daltonisme).
 *
 * `color`/`colorDark` sont des hex bruts (pas des classes Tailwind) car ils
 * alimentent directement des graphiques Recharts (fill, stroke) qui ne
 * passent pas par les classes CSS de l'app. `colorDark` n'est fourni que
 * lorsque `color` perd trop de contraste sur un fond sombre — sinon la même
 * valeur convient aux deux thèmes.
 */
export type PaymentMethod =
  | 'especes'
  | 'orange_money'
  | 'moov_money'
  | 'wave'
  | 'mtn_money'
  | 'virement'
  | 'autre'
  | 'non_precise'

export interface PaymentMethodMeta {
  id: PaymentMethod
  /** Clé de traduction du nom (ex. t(labelKey)). */
  labelKey: string
  Icon: LucideIcon
  color: string
  colorDark?: string
  /**
   * "Non précisé" est affiché en gris clair ET hachuré dans les graphiques
   * (jamais confondu avec une vraie répartition) — voir l'utilisation de ce
   * flag dans les composants donut/barres.
   */
  hatched?: boolean
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodMeta> = {
  especes: {
    id: 'especes',
    labelKey: 'wallet.deposit.paymentMethodCash',
    Icon: Banknote,
    color: '#0B6B39',
    colorDark: '#2FA968',
  },
  orange_money: {
    id: 'orange_money',
    labelKey: 'wallet.deposit.paymentMethodOrangeMoney',
    Icon: Smartphone,
    color: '#F28C00',
  },
  moov_money: {
    id: 'moov_money',
    labelKey: 'wallet.deposit.paymentMethodMoovMoney',
    Icon: Smartphone,
    color: '#2EC2E8',
  },
  wave: {
    id: 'wave',
    labelKey: 'wallet.deposit.paymentMethodWave',
    Icon: Zap,
    color: '#1458D6',
    colorDark: '#4C84F0',
  },
  mtn_money: {
    id: 'mtn_money',
    labelKey: 'wallet.deposit.paymentMethodMtnMoney',
    Icon: Smartphone,
    color: '#C99A00',
    colorDark: '#E8B800',
  },
  virement: {
    id: 'virement',
    labelKey: 'wallet.deposit.paymentMethodTransfer',
    Icon: Building2,
    color: '#4B2FD6',
    colorDark: '#8C74FF',
  },
  autre: {
    id: 'autre',
    labelKey: 'wallet.deposit.paymentMethodOther',
    Icon: MoreHorizontal,
    color: '#6B6B7B',
    colorDark: '#9A9AAE',
  },
  non_precise: {
    id: 'non_precise',
    labelKey: 'wallet.detail.paymentMethodUnknown',
    Icon: CircleHelp,
    color: '#C7C7D1',
    colorDark: '#4B4B5C',
    hatched: true,
  },
}

export const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  'especes',
  'orange_money',
  'moov_money',
  'wave',
  'mtn_money',
  'virement',
  'autre',
  'non_precise',
]

/** Normalise une valeur brute (API, éventuellement null) vers un `PaymentMethod` connu. */
export function toPaymentMethod(value: string | null | undefined): PaymentMethod {
  if (value && (PAYMENT_METHOD_ORDER as string[]).includes(value)) return value as PaymentMethod
  return 'non_precise'
}

export function paymentMethodMeta(value: string | null | undefined): PaymentMethodMeta {
  return PAYMENT_METHODS[toPaymentMethod(value)]
}
