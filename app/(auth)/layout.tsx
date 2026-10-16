'use client'

import AuthRoute from '@/components/AuthRoute'

/**
 * Layout du groupe de routes (auth) — /login, /signup, /verify : aucun menu
 * latéral ni barre du bas (ce groupe n'est jamais wrappé par
 * app/(dashboard)/layout.tsx), aucune donnée fetchée via React Query donc la
 * barre de progression globale ne se déclenche jamais ici. AuthRoute, posé
 * une seule fois ici plutôt que dans chacune des 3 pages, redirige vers
 * /dashboard tout utilisateur déjà connecté qui ouvre l'une de ces routes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthRoute>{children}</AuthRoute>
}
