import { API_BASE_URL } from '@/lib/api'

let woken = false

/**
 * Réveille le serveur dès l'ouverture de la connexion : s'il était endormi
 * (hébergement qui s'arrête après une période sans trafic), il démarre
 * pendant que l'utilisateur tape son mot de passe. GET /api/health ne
 * touche pas la base. Une seule fois par chargement de page ; échec ignoré.
 */
export function wakeServer(): void {
  if (woken || typeof window === 'undefined') return
  woken = true
  void fetch(`${API_BASE_URL}/api/health`, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' }).catch(() => {
    // Rien à faire : la vraie requête de connexion gérera l'erreur.
  })
}
