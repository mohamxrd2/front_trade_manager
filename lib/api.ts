import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'

/**
 * Configuration Axios pour Laravel Sanctum avec cookies HTTP-only
 * 
 * - baseURL: http://localhost:8000
 * - withCredentials: true (pour envoyer les cookies)
 * - Intercepteur pour récupérer automatiquement le cookie CSRF avant POST/PUT/DELETE
 * - Gestion du header X-XSRF-TOKEN pour les requêtes CSRF
 */
const api: AxiosInstance = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// Variable pour stocker le token CSRF
let xsrfToken: string | null = null

// Variable pour éviter les appels CSRF multiples simultanés
let csrfPromise: Promise<void> | null = null

// Flag pour indiquer qu'on est en train de se déconnecter
let isLoggingOut = false

// Flag pour indiquer qu'une redirection vers /login est en cours
// Cela permet d'éviter d'afficher des erreurs multiples lors de l'expiration de session
let isRedirectingToLogin = false

// Fonction pour définir le flag de déconnexion
export function setLoggingOut(value: boolean) {
  isLoggingOut = value
}

// Fonction pour vérifier si on est en train de se déconnecter
export function getIsLoggingOut(): boolean {
  return isLoggingOut
}

// Fonction pour définir le flag de redirection
export function setRedirectingToLogin(value: boolean) {
  isRedirectingToLogin = value
}

// Fonction pour vérifier si une redirection est en cours
export function getIsRedirectingToLogin(): boolean {
  return isRedirectingToLogin
}

/**
 * Extrait le token CSRF depuis les cookies de la réponse
 * Le cookie XSRF-TOKEN est envoyé par Laravel dans Set-Cookie
 */
function extractCsrfTokenFromCookies(cookies: string): string | null {
  if (!cookies) return null

  // Chercher le cookie XSRF-TOKEN (peut être XSRF-TOKEN ou xsrf-token)
  const patterns = [
    /XSRF-TOKEN=([^;]+)/i,
    /xsrf-token=([^;]+)/i,
  ]

  for (const pattern of patterns) {
    const match = cookies.match(pattern)
    if (match && match[1]) {
      // Décoder le token (Laravel encode parfois les valeurs de cookie)
      const token = decodeURIComponent(match[1])
      if (token && token.length > 0) {
        return token
      }
    }
  }

  return null
}

/**
 * Lit le token CSRF depuis document.cookie
 * Laravel Sanctum stocke le token dans un cookie non-HTTP-only (XSRF-TOKEN)
 */
function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie
  return extractCsrfTokenFromCookies(cookies)
}

/**
 * Récupère le cookie CSRF depuis Laravel Sanctum
 * et stocke le token pour l'utiliser dans les headers
 * Attend jusqu'à ce que le token soit disponible dans document.cookie
 */
async function getCsrfCookie(): Promise<void> {
  // Si une requête CSRF est déjà en cours, attendre qu'elle se termine
  if (csrfPromise) {
    await csrfPromise
    return
  }

  // Créer une nouvelle promesse pour la requête CSRF
  csrfPromise = api
    .get('/sanctum/csrf-cookie')
    .then(async () => {
      // Attendre que le cookie soit disponible dans document.cookie
      // Le navigateur peut mettre un peu de temps à traiter le cookie
      let attempts = 0
      const maxAttempts = 10
      const delayMs = 50

      while (attempts < maxAttempts) {
        const token = readCsrfTokenFromCookie()
        if (token) {
          xsrfToken = token
          if (process.env.NODE_ENV !== 'production') {
            console.debug('✅ Token CSRF récupéré depuis document.cookie', `(tentative ${attempts + 1})`)
          }
          csrfPromise = null
          return
        }

        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, delayMs))
        attempts++
      }

      // Si après toutes les tentatives le token n'est toujours pas disponible
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Token CSRF non trouvé après plusieurs tentatives')
      }
      csrfPromise = null
    })
    .catch((error) => {
      csrfPromise = null
      // En développement, logger l'erreur mais continuer
      if (process.env.NODE_ENV !== 'production') {
        console.debug('⚠️ CSRF cookie non disponible:', error?.message || 'Erreur inconnue')
      }
      // Ne pas throw l'erreur pour ne pas bloquer les requêtes
    })

  return csrfPromise
}

/**
 * Intercepteur de requête : récupère automatiquement le cookie CSRF
 * avant chaque requête POST, PUT, PATCH, DELETE et ajoute le header X-XSRF-TOKEN
 */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Vérifier si c'est une méthode qui nécessite CSRF
    const method = config.method?.toUpperCase()
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '')

    // Si c'est déjà la requête CSRF elle-même, ne pas la modifier
    if (config.url === '/sanctum/csrf-cookie') {
      return config
    }

    // Si la méthode nécessite CSRF, récupérer le cookie avant
    if (needsCsrf) {
      try {
        // D'abord, essayer de lire le token depuis document.cookie (si déjà présent)
        if (!xsrfToken && typeof document !== 'undefined') {
          xsrfToken = readCsrfTokenFromCookie()
        }

        // Si on n'a toujours pas le token, le récupérer depuis le serveur
        if (!xsrfToken) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('🔄 Récupération du cookie CSRF pour la requête:', config.url)
          }
          await getCsrfCookie()
          // Après getCsrfCookie(), le token devrait être disponible
          // Réessayer de lire depuis document.cookie (getCsrfCookie attend déjà)
          xsrfToken = readCsrfTokenFromCookie()
          
          // Si toujours pas disponible, attendre un peu et réessayer
          if (!xsrfToken && typeof document !== 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100))
            xsrfToken = readCsrfTokenFromCookie()
            
            // Dernière tentative
            if (!xsrfToken) {
              await new Promise(resolve => setTimeout(resolve, 100))
              xsrfToken = readCsrfTokenFromCookie()
            }
          }
        }

        // Ajouter le header X-XSRF-TOKEN si on a le token
        if (xsrfToken && config.headers) {
          config.headers['X-XSRF-TOKEN'] = xsrfToken
          if (process.env.NODE_ENV !== 'production') {
            console.debug('📤 Header X-XSRF-TOKEN ajouté à la requête:', config.url)
            console.debug('   Token (premiers 30 caractères):', xsrfToken.substring(0, 30) + '...')
          }
        } else {
          // Si le token n'est toujours pas disponible, c'est un problème critique
          if (process.env.NODE_ENV !== 'production') {
            console.error('❌ ERREUR CRITIQUE: Token CSRF non disponible pour la requête', config.url)
            console.error('   Tous les cookies disponibles:', typeof document !== 'undefined' ? document.cookie : 'N/A')
            console.error('   xsrfToken stocké:', xsrfToken)
            console.error('   Cette requête va probablement échouer avec une erreur 419')
          }
          // Ne pas bloquer la requête, mais elle échouera probablement
          // Cela permet au backend de renvoyer une erreur 419 claire
        }
      } catch (error) {
        // En cas d'erreur, continuer quand même (le backend peut ne pas nécessiter CSRF)
        if (process.env.NODE_ENV !== 'production') {
          console.debug('⚠️ Erreur lors de la récupération du cookie CSRF:', error)
        }
      }
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Intercepteur de réponse : lit le token CSRF depuis document.cookie après chaque requête
 * et gestion globale des erreurs avec retry automatique pour les erreurs 419
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Après chaque requête, vérifier si le token CSRF est disponible dans document.cookie
    // (utile si le token a été mis à jour par le serveur)
    if (typeof document !== 'undefined') {
      const token = readCsrfTokenFromCookie()
      if (token) {
        // Mettre à jour le token même si on en a déjà un (au cas où il a changé)
        xsrfToken = token
        if (process.env.NODE_ENV !== 'production' && response.config.url === '/sanctum/csrf-cookie') {
          console.debug('✅ Token CSRF mis à jour depuis document.cookie après réponse')
          console.debug('   Token (premiers 30 caractères):', token.substring(0, 30) + '...')
        }
      } else if (response.config.url === '/sanctum/csrf-cookie' && process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Token CSRF non trouvé dans document.cookie après l\'appel /sanctum/csrf-cookie')
        console.warn('   Cela peut indiquer un problème de configuration CORS ou de domaine')
      }
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Gestion spécifique de l'erreur 419 avec retry automatique
    if (error.response?.status === 419 && originalRequest && !originalRequest._retry) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Erreur 419 détectée - Tentative de récupération d\'un nouveau token CSRF')
        console.warn('   Token actuel:', xsrfToken ? xsrfToken.substring(0, 30) + '...' : 'AUCUN')
      }

      // Marquer la requête comme étant en cours de retry
      originalRequest._retry = true

      // Réinitialiser le token pour forcer une nouvelle récupération
      xsrfToken = null

      try {
        // Récupérer un nouveau token CSRF
        await getCsrfCookie()

        // Attendre un peu pour que le cookie soit bien disponible
        await new Promise(resolve => setTimeout(resolve, 200))

        // Lire le nouveau token depuis document.cookie
        const newToken = readCsrfTokenFromCookie()
        if (newToken) {
          xsrfToken = newToken
          if (process.env.NODE_ENV !== 'production') {
            console.debug('✅ Nouveau token CSRF récupéré, nouvelle tentative de la requête')
          }

          // Ajouter le nouveau token au header de la requête originale
          if (originalRequest.headers) {
            originalRequest.headers['X-XSRF-TOKEN'] = newToken
          }

          // Réessayer la requête originale avec le nouveau token
          return api(originalRequest)
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error('❌ Impossible de récupérer un nouveau token CSRF après erreur 419')
            console.error('   Cookies disponibles:', typeof document !== 'undefined' ? document.cookie : 'N/A')
          }
        }
      } catch (csrfError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ Erreur lors de la récupération du nouveau token CSRF:', csrfError)
        }
      }
    } else if (error.response?.status === 419 && originalRequest && originalRequest._retry) {
      // Si on a déjà fait un retry et que ça échoue encore, c'est un problème plus grave
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur 419 persistante après retry - Le token CSRF ne peut pas être récupéré')
        console.error('   Vérifiez la configuration CORS et SANCTUM_STATEFUL_DOMAINS dans Laravel')
      }
    }
    
    // Gestion de l'erreur 401 (Non authentifié) : rediriger vers /login
    // Ignorer les erreurs 401 pendant la déconnexion (c'est normal)
    if (error.response?.status === 401 && !isLoggingOut) {
      // Vérifier si on est sur une route protégée (dashboard)
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname
        const isProtectedRoute = currentPath.startsWith('/dashboard') || 
                                  currentPath.startsWith('/wallet') ||
                                  currentPath.startsWith('/analytics') ||
                                  currentPath.startsWith('/products') ||
                                  currentPath.startsWith('/collaborators') ||
                                  currentPath.startsWith('/notifications') ||
                                  currentPath.startsWith('/settings') ||
                                  currentPath.startsWith('/onboarding')
        
        // Si on est sur une route protégée et qu'on reçoit une 401, rediriger vers /login
        if (isProtectedRoute && currentPath !== '/login') {
          // Si une redirection est déjà en cours, marquer cette erreur comme silencieuse
          if (isRedirectingToLogin) {
            const silentError = new Error('Unauthorized - Redirecting to login (silent)') as Error & { 
              silent?: boolean 
              response?: { status?: number }
            }
            silentError.silent = true
            silentError.response = { status: 401 }
            return Promise.reject(silentError)
          }
          
          // Marquer qu'une redirection est en cours pour éviter les erreurs multiples
          isRedirectingToLogin = true
          
          // Émettre un événement pour que AuthContext mette à jour l'état
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))
          
          // Rediriger vers /login après un court délai pour permettre aux autres requêtes
          // de détecter le flag isRedirectingToLogin
          setTimeout(() => {
            window.location.href = '/login'
          }, 50)
          
          // Rejeter avec une erreur silencieuse pour éviter les logs et toasts
          const silentError = new Error('Unauthorized - Redirecting to login') as Error & { 
            silent?: boolean 
            response?: { status?: number }
          }
          silentError.silent = true
          silentError.response = { status: 401 }
          return Promise.reject(silentError)
        }
      }
    }
    
    // Si on est en train de se déconnecter et qu'on reçoit une 401, c'est normal
    // Ne pas afficher d'erreur, juste rejeter silencieusement avec une erreur spéciale
    // qui sera ignorée par les services et les composants
    if (error.response?.status === 401 && isLoggingOut) {
      const silentError = new Error('Unauthorized during logout - Ignoring') as Error & { 
        isLoggingOut?: boolean 
        silent?: boolean 
        response?: { status?: number }
      }
      silentError.isLoggingOut = true
      silentError.silent = true
      // Préserver la structure de l'erreur axios pour que les services puissent la détecter
      silentError.response = { status: 401 }
      return Promise.reject(silentError)
    }
    
    // Les erreurs sont gérées dans les fonctions auth individuelles
    return Promise.reject(error)
  }
)

export default api

