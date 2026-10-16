import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion · Waelly',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
