/**
 * Calcul PUR des parts et montants des membres (gérant compris) d'une
 * entreprise — aucun accès réseau, aucun état : une seule fonction, utilisée
 * par UN SEUL hook (lib/hooks/useCollaboratorShares.ts), lui-même utilisé par
 * tous les écrans affichant une part ou un montant. Aucun autre endroit de
 * l'app ne doit refaire ce calcul.
 *
 * Règle de répartition :
 * - Base = Entrées (total des ventes) − Sorties (total des dépenses),
 *   toujours les TOTAUX renvoyés par le backend (jamais une somme de
 *   transactions paginées côté client, qui serait incomplète).
 * - Part de chaque collaborateur : la valeur (%) enregistrée.
 * - Part du gérant = 100 − somme des parts des collaborateurs actifs.
 *   Toujours calculée, jamais lue d'une valeur figée (ex. une colonne
 *   `company_share` en base qui ne se resynchronise pas toute seule).
 * - Montant = base × part / 100, arrondi à l'unité (FCFA) — SAUF celui du
 *   gérant, qui reçoit explicitement ce qu'il reste (base − somme des
 *   montants déjà arrondis des autres), afin que la somme de TOUS les
 *   montants soit toujours exactement égale à la base, quels que soient les
 *   arrondis individuels.
 *
 * IMPORTANT (prépare la suite) : une fois que les apports de fonds et les
 * retraits existeront, ils NE devront JAMAIS entrer dans `base` — un apport
 * n'est pas un bénéfice à partager, c'est de l'argent que le gérant remet
 * lui-même dans l'entreprise (et un retrait en est le symétrique). `base`
 * doit rester strictement "ventes − dépenses", jamais "ventes − dépenses +
 * apports − retraits".
 */

export interface CollaboratorShareInput {
  id: string
  /** Part enregistrée (%, 0-100). Ignorée pour le gérant : sa part est
   * toujours recalculée à partir de celle des autres, jamais lue ici. */
  share: number
  isOwner: boolean
}

export interface ComputeSharesInput {
  /** Ventes totales − dépenses totales, depuis le début (totaux backend). Peut être négative. */
  base: number
  collaborators: CollaboratorShareInput[]
}

export interface ComputedShare {
  id: string
  isOwner: boolean
  /** Part (%), toujours calculée pour le gérant. */
  share: number
  /** Montant en FCFA, arrondi à l'unité. */
  amount: number
}

export function computeShares({ base, collaborators }: ComputeSharesInput): ComputedShare[] {
  const owner = collaborators.find((c) => c.isOwner) ?? null
  const nonOwners = collaborators.filter((c) => !c.isOwner)

  const sumOtherShares = nonOwners.reduce((sum, c) => sum + c.share, 0)
  const ownerShare = 100 - sumOtherShares

  const nonOwnerResults: ComputedShare[] = nonOwners.map((c) => ({
    id: c.id,
    isOwner: false,
    share: c.share,
    amount: Math.round((base * c.share) / 100),
  }))

  const sumOtherAmounts = nonOwnerResults.reduce((sum, r) => sum + r.amount, 0)
  // Math.round(base) : la base est déjà censée être un montant FCFA entier
  // (totaux backend), mais on arrondit quand même pour garantir un entier
  // même si un résidu flottant s'y glissait — sinon la somme ne tomberait
  // pas exactement juste à cause d'une erreur de précision binaire.
  const ownerAmount = Math.round(base) - sumOtherAmounts

  const results: ComputedShare[] = []
  if (owner) {
    results.push({ id: owner.id, isOwner: true, share: ownerShare, amount: ownerAmount })
  }
  results.push(...nonOwnerResults)

  return results
}
