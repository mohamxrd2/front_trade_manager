/**
 * Prix de la page de présentation (components/landing/pricing.tsx) —
 * SEUL fichier à modifier quand les prix réels seront fixés. "[PRIX]" est un
 * placeholder volontaire (voir waelly-presentation/README.md), pas un bug.
 */

export type BillingPeriod = 'monthly' | 'yearly'

export interface PricingPlan {
  id: 'decouverte' | 'pro' | 'equipe'
  nameKey: string
  taglineKey: string
  featureKeys: string[]
  ctaKey: string
  featured: boolean
  price: Record<BillingPeriod, string>
}

export const YEARLY_DISCOUNT_KEY = 'landing.pricing.yearlyDiscount'

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'decouverte',
    nameKey: 'landing.pricing.plans.decouverte.name',
    taglineKey: 'landing.pricing.plans.decouverte.tagline',
    featureKeys: [
      'landing.pricing.plans.decouverte.feature1',
      'landing.pricing.plans.decouverte.feature2',
      'landing.pricing.plans.decouverte.feature3',
      'landing.pricing.plans.decouverte.feature4',
    ],
    ctaKey: 'landing.pricing.plans.decouverte.cta',
    featured: false,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
  {
    id: 'pro',
    nameKey: 'landing.pricing.plans.pro.name',
    taglineKey: 'landing.pricing.plans.pro.tagline',
    featureKeys: [
      'landing.pricing.plans.pro.feature1',
      'landing.pricing.plans.pro.feature2',
      'landing.pricing.plans.pro.feature3',
      'landing.pricing.plans.pro.feature4',
    ],
    ctaKey: 'landing.pricing.plans.pro.cta',
    featured: true,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
  {
    id: 'equipe',
    nameKey: 'landing.pricing.plans.equipe.name',
    taglineKey: 'landing.pricing.plans.equipe.tagline',
    featureKeys: [
      'landing.pricing.plans.equipe.feature1',
      'landing.pricing.plans.equipe.feature2',
      'landing.pricing.plans.equipe.feature3',
      'landing.pricing.plans.equipe.feature4',
    ],
    ctaKey: 'landing.pricing.plans.equipe.cta',
    featured: false,
    price: { monthly: '[PRIX]', yearly: '[PRIX]' },
  },
]

export function periodSuffixKey(period: BillingPeriod): string {
  return period === 'yearly' ? 'landing.pricing.perYear' : 'landing.pricing.perMonth'
}
