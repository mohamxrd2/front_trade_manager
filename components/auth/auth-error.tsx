interface AuthErrorProps {
  children: React.ReactNode | null | undefined
}

/** Bandeau d'erreur serveur en haut du formulaire, commun aux 3 pages d'auth. */
export function AuthError({ children }: AuthErrorProps) {
  if (!children) return null

  return (
    <div role="alert" className="rounded-[14px] bg-[#FDE8EC] px-3.5 py-3 text-sm font-semibold text-[#A3213A]">
      {children}
    </div>
  )
}
