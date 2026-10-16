/**
 * Prix de la page de présentation (components/landing/pricing.tsx) —
 * SEUL fichier à modifier quand les prix réels seront fixés. "[PRIX]" est un
 * placeholder volontaire (voir waelly-presentation/README.md), pas un bug.
 */

export type BillingPeriod = 'monthly' | 'yearly'

export interface PricingPlan {
  id: 'decouverte' | 'pro' | 'equipe'
  name: string
  tagline: string
  features: string[]
  cta: string
  featured: boolean
  price: Record<BillingPeriod, string>
}

export const YEARLY_DISCOUNT_LABEL = '2 mois offerts'

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'decouverte',
    name: 'Découverte',
    tagline: 'Pour démarrer seul',
    features: ['1 utilisateur', 'Stock et ventes illimités', 'Factures PDF', 'Analyses de base'],
    cta: 'Commencer',
    featured: false,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour les boutiques qui grandissent',
    features: [
      'Jusqu’à 5 collaborateurs',
      'Articles à variations',
      'Factures à vos couleurs',
      'Prévisions et comparaisons',
    ],
    cta: 'Essayer Pro',
    featured: true,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
  {
    id: 'equipe',
    name: 'Équipe',
    tagline: 'Pour plusieurs points de vente',
    features: ['Collaborateurs illimités', 'Parts et rôles', 'Support prioritaire', 'Export des données'],
    cta: 'Nous contacter',
    featured: false,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
]

export function periodSuffix(period: BillingPeriod): string {
  return period === 'yearly' ? 'FCFA / an' : 'FCFA / mois'
}
