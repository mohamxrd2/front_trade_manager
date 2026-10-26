import { ArrowDownLeft, ArrowUpRight, Banknote, PiggyBank, type LucideIcon } from 'lucide-react'

/**
 * Normalise un `type` de transaction brut (API) vers l'une des 4 natures
 * connues — toute valeur inconnue (ancien/nouveau type pas encore géré par ce
 * frontend) retombe sur 'other', affichée comme "Opération" plutôt que de
 * planter (voir getTransactionVisual ci-dessous).
 */
export type TransactionKind = 'sale' | 'expense' | 'apport' | 'retrait' | 'other'

export function getTransactionKind(type: string | null | undefined): TransactionKind {
  if (type === 'sale' || type === 'expense' || type === 'apport' || type === 'retrait') return type
  return 'other'
}

export interface TransactionVisual {
  kind: TransactionKind
  /** Clé de traduction du libellé du type (ex. t(labelKey)). */
  labelKey: string
  sign: '+' | '−' | ''
  Icon: LucideIcon
  /** Classes Tailwind pour le montant coloré. */
  amountClassName: string
  /** Classes Tailwind pour la pastille/icône ronde (fond + texte). */
  iconClassName: string
  /** Classes Tailwind pour un badge de type (liste ordinateur). */
  badgeClassName: string
  /** Même information que badgeClassName, sous forme de `tone` pour <StatusBadge>. */
  badgeTone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand'
}

// Vente = vert (succès), Dépense = rouge (danger) — inchangé. Apport = indigo
// (brand-700, #3A20B8 — déjà le jeton de design utilisé pour "Part" sur
// Collaborateurs), jamais vert : ne doit pas être confondu avec une vente
// (règle explicite du produit). Retrait = orange (warning, #8A4B00) — même
// jeton que les badges "en stock faible" ailleurs dans l'app.
const VISUALS: Record<TransactionKind, TransactionVisual> = {
  sale: {
    kind: 'sale',
    labelKey: 'transactions.sale',
    sign: '+',
    Icon: ArrowUpRight,
    amountClassName: 'text-success',
    iconClassName: 'bg-success-bg text-success-strong',
    badgeClassName: 'bg-success-bg text-success-strong',
    badgeTone: 'success',
  },
  expense: {
    kind: 'expense',
    labelKey: 'transactions.expense',
    sign: '−',
    Icon: ArrowDownLeft,
    amountClassName: 'text-danger',
    iconClassName: 'bg-danger-bg text-danger-strong',
    badgeClassName: 'bg-danger-bg text-danger-strong',
    badgeTone: 'danger',
  },
  apport: {
    kind: 'apport',
    labelKey: 'transactions.deposit',
    sign: '+',
    Icon: PiggyBank,
    amountClassName: 'text-brand-700',
    iconClassName: 'bg-brand-100 text-brand-700',
    badgeClassName: 'bg-brand-100 text-brand-700',
    badgeTone: 'brand',
  },
  retrait: {
    kind: 'retrait',
    labelKey: 'transactions.withdrawal',
    sign: '−',
    Icon: Banknote,
    amountClassName: 'text-warning',
    iconClassName: 'bg-warning-bg text-warning',
    badgeClassName: 'bg-warning-bg text-warning',
    badgeTone: 'warning',
  },
  other: {
    kind: 'other',
    labelKey: 'transactions.operation',
    sign: '',
    Icon: ArrowUpRight,
    amountClassName: 'text-ink',
    iconClassName: 'bg-surface-soft text-ink-3',
    badgeClassName: 'bg-surface-soft text-ink-3',
    badgeTone: 'neutral',
  },
}

/**
 * Source UNIQUE d'icône/couleur/libellé pour un type de transaction — utilisée
 * par Portefeuille, Accueil ("Dernières opérations") et les popups de détail,
 * pour ne jamais diverger (et ne jamais planter sur un type pas encore connu).
 */
export function getTransactionVisual(type: string | null | undefined): TransactionVisual {
  return VISUALS[getTransactionKind(type)]
}

/** Libellé d'origine d'un apport (chips du formulaire + détail/liste). */
export function fundingSourceLabelKey(fundingSource: string | null | undefined): string | null {
  switch (fundingSource) {
    case 'apport_personnel':
      return 'wallet.deposit.fundingSourcePersonal'
    case 'collaborateur':
      return 'wallet.deposit.fundingSourceCollaborator'
    case 'pret':
      return 'wallet.deposit.fundingSourceLoan'
    case 'autre':
      return 'wallet.deposit.fundingSourceOther'
    default:
      return null
  }
}

/** Libellé de moyen de paiement (chips du formulaire + détail/liste). */
export function paymentMethodLabelKey(paymentMethod: string | null | undefined): string | null {
  switch (paymentMethod) {
    case 'especes':
      return 'wallet.deposit.paymentMethodCash'
    case 'orange_money':
      return 'wallet.deposit.paymentMethodOrangeMoney'
    case 'moov_money':
      return 'wallet.deposit.paymentMethodMoovMoney'
    case 'wave':
      return 'wallet.deposit.paymentMethodWave'
    case 'mtn_money':
      return 'wallet.deposit.paymentMethodMtnMoney'
    case 'virement':
      return 'wallet.deposit.paymentMethodTransfer'
    default:
      return null
  }
}
