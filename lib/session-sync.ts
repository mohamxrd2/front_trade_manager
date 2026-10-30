import type { User } from './auth'

/**
 * Synchronisation de session entre onglets (chantier "Équipe" — bug
 * account_id mal rattaché) : Sanctum utilise un cookie de session PARTAGÉ
 * par tous les onglets du même navigateur. Si l'un se déconnecte puis se
 * reconnecte à un AUTRE compte, les autres onglets restent affichés sur
 * l'ancien compte alors que leurs futures requêtes s'exécuteraient déjà
 * sur le nouveau (le cookie a changé pour tout le navigateur) — d'où
 * l'en-tête X-Account-Id (voir lib/api.ts) et cette diffusion inter-onglets.
 *
 * `BroadcastChannel` est utilisé en priorité (simple, pas de bruit dans
 * localStorage) ; l'évènement `storage` sert de repli pour les navigateurs
 * qui ne le supportent pas (Safari < 15.4).
 */

const CHANNEL_NAME = 'waelly-session-sync'
const STORAGE_FALLBACK_KEY = 'waelly-session-sync-ping'

let displayedAccountId: string | null = null
let channel: BroadcastChannel | null = null

function supportsBroadcastChannel(): boolean {
  return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
}

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
  }
  return channel
}

/**
 * Le compte "affiché" par cet onglet : celui du propriétaire pour un
 * propriétaire, celui du propriétaire ÉGALEMENT pour un membre (account_id)
 * — jamais l'id propre du membre. Même règle que User::accountId() côté
 * backend (app/Models/User.php).
 */
export function displayedAccountIdOf(user: Pick<User, 'id' | 'account_id'>): string {
  return user.account_id ?? user.id
}

/** Valeur courante, lue par l'intercepteur axios (lib/api.ts) pour poser X-Account-Id. */
export function getDisplayedAccountId(): string | null {
  return displayedAccountId
}

/** Mis à jour par AuthContext après chaque résolution d'identité réussie (login/checkAuth/...) et à la déconnexion (null). */
export function setDisplayedAccountId(id: string | null): void {
  displayedAccountId = id
}

/**
 * Prévient les AUTRES onglets qu'une connexion/déconnexion/changement de
 * compte vient d'avoir lieu dans celui-ci. Ne transporte aucune donnée
 * d'identité : chaque onglet qui reçoit le signal revérifie lui-même sa
 * session (GET /api/user) plutôt que de faire confiance au message.
 */
export function announceSessionChange(): void {
  if (typeof window === 'undefined') return

  if (supportsBroadcastChannel()) {
    getChannel().postMessage(Date.now())
    return
  }

  try {
    window.localStorage.setItem(STORAGE_FALLBACK_KEY, String(Date.now()))
  } catch {
    // Stockage indisponible (navigation privée stricte, quota plein) : pas de synchronisation possible, tant pis.
  }
}

/**
 * S'abonne aux signaux des AUTRES onglets (jamais le sien : ni
 * BroadcastChannel ni l'évènement `storage` ne se livrent à l'émetteur).
 * Retourne la fonction de désabonnement.
 */
export function onSessionChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  if (supportsBroadcastChannel()) {
    const bc = getChannel()
    const handler = () => callback()
    bc.addEventListener('message', handler)
    return () => bc.removeEventListener('message', handler)
  }

  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_FALLBACK_KEY) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/**
 * Le backend renvoie sur chaque réponse le compte de la SESSION
 * (`X-Account-Id`, voir EnsureAccountHeaderMatchesSession). Vrai quand cet
 * onglet affiche un autre compte : un autre onglet a changé de session sur
 * le cookie partagé, et cette réponse contient les données de l'AUTRE
 * compte — elle ne doit jamais être affichée ici.
 *
 * GET /api/user est exclu : c'est précisément la requête par laquelle
 * l'onglet apprend son (nouveau) compte et met à jour le compte affiché.
 */
export function isAccountMismatch(
  displayedAccountId: string | null,
  responseAccountId: string | null | undefined,
  url: string | undefined
): boolean {
  if (!displayedAccountId || !responseAccountId) return false
  if (url && /\/api\/user\/?(\?.*)?$/.test(url)) return false
  return displayedAccountId !== responseAccountId
}

