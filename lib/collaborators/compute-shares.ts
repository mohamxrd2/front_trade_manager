/**
 * Calcul PUR des parts et montants des membres (gérant compris) d'une
 * entreprise — aucun accès réseau, aucun état : une seule fonction, utilisée
 * par UN SEUL hook (lib/hooks/useCollaboratorShares.ts), lui-même utilisé par
 * tous les écrans affichant une part ou un montant. Aucun autre endroit de
 * l'app ne doit refaire ce calcul.
 *
 * Règle de répartition :
 * - Base de répartition = solde (ventes − dépenses + apports − retraits).
 *   Décision métier du 26/10/2026. Toujours la valeur backend `balance`
 *   (GET /api/user, voir lib/hooks/useCollaboratorShares.ts), jamais une
 *   somme de transactions paginées côté client, qui serait incomplète.
 *   Un apport augmente donc le montant de TOUS les membres (gérant compris)
 *   selon leur part, un retrait le diminue — contrairement au chiffre
 *   d'affaires/bénéfice (voir calculated_wallet côté backend), qui n'inclut
 *   toujours pas les apports/retraits.
 * - Part de chaque collaborateur : la valeur (%) enregistrée.
 * - Part du gérant = 100 − somme des parts des collaborateurs actifs.
 *   Toujours calculée, jamais lue d'une valeur figée (ex. une colonne
 *   `company_share` en base qui ne se resynchronise pas toute seule).
 * - Montant = base × part / 100, arrondi à l'unité (FCFA) — SAUF celui du
 *   gérant, qui reçoit explicitement ce qu'il reste (base − somme des
 *   montants déjà arrondis des autres), afin que la somme de TOUS les
 *   montants soit toujours exactement égale à la base, quels que soient les
 *   arrondis individuels.
 */

export interface CollaboratorShareInput {
  id: string
  /** Part enregistrée (%, 0-100). Ignorée pour le gérant : sa part est
   * toujours recalculée à partir de celle des autres, jamais lue ici. */
  share: number
  isOwner: boolean
}

export interface ComputeSharesInput {
  /** Solde (ventes − dépenses + apports − retraits), depuis le début
   * (valeur backend `balance`). Peut être négative. */
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
