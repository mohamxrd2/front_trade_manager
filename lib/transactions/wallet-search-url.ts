/**
 * Synchronisation URL ⇄ état de la recherche du Portefeuille — pure, sans
 * dépendance à next/navigation, pour rester testable indépendamment du
 * rendu React (voir app/(dashboard)/wallet/page.tsx, qui n'est qu'un fin
 * appelant de ces deux fonctions).
 */

export interface WalletSearchUrlState {
  q: string // déjà le texte effectif (après debounce + isSearchableQuery) — '' si absent
  type: string // 'all' si absent
  from: string | null
  to: string | null
  page: number
}

/**
 * Construit l'URL (chemin + querystring) à partir de l'état de recherche —
 * n'émet un paramètre que s'il diverge de sa valeur par défaut, pour garder
 * des URLs propres (`/wallet` plutôt que `/wallet?type=all&page=1`).
 */
export function buildWalletSearchUrl(pathname: string, state: WalletSearchUrlState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.type !== 'all') params.set('type', state.type)
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)
  if (state.page > 1) params.set('page', String(state.page))

  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/**
 * Relit l'état initial depuis une querystring déjà présente (chargement de
 * page, lien partagé, retour arrière du navigateur).
 */
export function parseWalletSearchUrl(searchParams: URLSearchParams): WalletSearchUrlState {
  return {
    q: searchParams.get('q') ?? '',
    type: searchParams.get('type') ?? 'all',
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    page: Math.max(1, Number(searchParams.get('page')) || 1),
  }
}

/**
 * Un filtre (recherche texte, plage de dates ou type) est actif — pilote
 * l'affichage des puces de filtre actif, de l'en-tête "N résultats" et du
 * choix entre l'état vide "Aucune transaction trouvée" (recherche active
 * sans résultat) et l'état vide générique "Aucune opération sur cette
 * période" (aucun filtre, juste pas de données).
 */
export function hasActiveSearchFilters(state: { q: string; type: string; from: string | null }): boolean {
  return state.q !== '' || state.from !== null || state.type !== 'all'
}
