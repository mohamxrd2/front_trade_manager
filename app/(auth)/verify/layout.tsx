import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vérification · Waelly',
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
