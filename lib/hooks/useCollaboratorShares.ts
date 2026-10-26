'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/query-keys'
import { getCollaborators, type Collaborator } from '@/lib/services/collaborators'
import { useUserStats } from './useArticles'
import { computeShares, type ComputedShare } from '@/lib/collaborators/compute-shares'

const OWNER_ID = 'owner'

export interface UseCollaboratorSharesResult {
  /** Base de répartition = solde (ventes − dépenses + apports − retraits).
   * Décision métier du 26/10/2026 : les apports/retraits du gérant font
   * désormais partie de l'argent partagé entre gérant et collaborateurs —
   * un apport augmente les montants de tous, un retrait les diminue.
   * Toujours la valeur backend (`GET /api/user`.balance), jamais une somme
   * de transactions paginées côté client. */
  base: number
  /** true si la base est négative (plus de dépenses que de ventes sur la période). */
  isNegativeBase: boolean
  isLoading: boolean
  /** Liste brute des collaborateurs (nom, téléphone, part enregistrée...). */
  collaborators: Collaborator[]
  /** Part + montant du gérant, toujours recalculés, jamais lus d'une colonne figée. */
  ownerShare: ComputedShare
  /** Part (%) encore disponible pour un nouveau collaborateur (100 − somme des parts actives) — pour le formulaire d'ajout. */
  remainingShare: number
  /** Part + montant d'un collaborateur précis, par id. */
  getShare: (collaboratorId: string) => ComputedShare | undefined
}

/**
 * Source UNIQUE de vérité pour les parts et montants affichés dans l'app
 * (gérant compris). Tout écran qui affiche une part ou un montant doit
 * passer par ce hook — aucun autre calcul ailleurs (voir
 * lib/collaborators/compute-shares.ts pour la règle de calcul).
 *
 * Se met à jour automatiquement :
 * - après ajout/modification/retrait d'un collaborateur : la clé
 *   `keys.collaborators.all` est invalidée par les mutations de
 *   /collaborators, ce qui refait tourner ce hook avec la part à jour ;
 * - après une vente/dépense/apport/retrait : `keys.userStats.all` est
 *   invalidée par invalidateUserStats() (déjà appelé après chaque
 *   transaction), ce qui rafraîchit `base` automatiquement.
 *
 * Avant ce hook, la part du gérant était lue depuis `user.company_share`
 * (contexte d'auth, rafraîchi seulement par un appel explicite à
 * checkAuth()) et son montant depuis `user.wallet` (calculé côté backend) —
 * aucun des deux n'était raccroché à l'invalidation TanStack Query des
 * collaborateurs, d'où le gel observé même après un ajout/retrait réussi.
 */
export function useCollaboratorShares(): UseCollaboratorSharesResult {
  const { stats, isLoading: statsLoading } = useUserStats()
  const { data: collaborators, isLoading: collabLoading } = useQuery({
    queryKey: keys.collaborators.all,
    queryFn: getCollaborators,
  })

  const base = stats?.balance ?? 0

  const shares = React.useMemo(() => {
    const input = [
      { id: OWNER_ID, share: 0, isOwner: true },
      ...(collaborators ?? []).map((c) => ({ id: c.id, share: Number(c.part), isOwner: false })),
    ]
    return computeShares({ base, collaborators: input })
  }, [base, collaborators])

  const shareById = React.useMemo(() => {
    const map = new Map<string, ComputedShare>()
    shares.forEach((s) => map.set(s.id, s))
    return map
  }, [shares])

  const ownerShare = shareById.get(OWNER_ID) ?? { id: OWNER_ID, isOwner: true, share: 100, amount: base }

  const remainingShare = 100 - (collaborators ?? []).reduce((sum, c) => sum + Number(c.part), 0)

  return {
    base,
    isNegativeBase: base < 0,
    isLoading: statsLoading || collabLoading,
    collaborators: collaborators ?? [],
    ownerShare,
    remainingShare,
    getShare: (collaboratorId: string) => shareById.get(collaboratorId),
  }
}
