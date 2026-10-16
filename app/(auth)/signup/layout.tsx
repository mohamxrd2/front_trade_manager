import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un compte · Waelly',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
