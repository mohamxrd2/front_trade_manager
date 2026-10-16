import { CtaFooter } from '@/components/landing/cta-footer'
import { Countries } from '@/components/landing/countries'
import { Faq } from '@/components/landing/faq'
import { Features } from '@/components/landing/features'
import { Hero } from '@/components/landing/hero'
import { Network } from '@/components/landing/network'
import { Pricing } from '@/components/landing/pricing'
import { SaleSteps } from '@/components/landing/sale-steps'
import { Stats } from '@/components/landing/stats'

export default function MarketingPage() {
  return (
    <main>
      <Hero />
      <Stats />
      <Features />
      <SaleSteps />
      <Countries />
      <Network />
      <Pricing />
      <Faq />
      <CtaFooter />
    </main>
  )
}
