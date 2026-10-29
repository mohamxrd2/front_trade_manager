import { redirect } from 'next/navigation'

/** "Collaborateurs" renommé en "Équipe" (chantier "Équipe" étape 3, §1) — ancienne URL conservée en redirection permanente vers /team. */
export default function CollaboratorsRedirectPage() {
  redirect('/team')
}
