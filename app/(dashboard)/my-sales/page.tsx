import { redirect } from 'next/navigation'

/** « Mes ventes » utilise désormais la même page que le Portefeuille du gérant (/wallet), filtrée côté serveur — ancienne URL conservée en redirection. */
export default function MySalesRedirectPage() {
  redirect('/wallet')
}
