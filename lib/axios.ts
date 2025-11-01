import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// Configuration de base d'axios
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, // Timeout de 10 secondes
  // withCredentials: true, // Décommenter seulement si CORS est correctement configuré dans Laravel
})

// Intercepteur pour ajouter automatiquement le token d'authentification
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Récupérer le token depuis localStorage
    const token = localStorage.getItem('auth_token')
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Intercepteur pour gérer les réponses et les erreurs
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    // Si l'erreur est 401 (non autorisé)
    if (error.response?.status === 401) {
      const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login')
      
      // Ne pas rediriger ni logger si on est déjà sur la page de login
      // (les erreurs d'authentification sont normales ici)
      if (!isOnLoginPage) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
        
        // Rediriger vers la page de login si on n'y est pas déjà
        window.location.href = '/login'
      }
      // Sinon, on laisse l'erreur passer pour qu'elle soit gérée par le service auth
    }
    
    // Gérer les erreurs de timeout (ne pas polluer la console)
    if (error.code === 'ECONNABORTED') {
      // Utiliser debug pour éviter d'afficher en erreur dans la console
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[axios] Timeout: requête trop longue', {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout,
        })
      }
    }
    
    // Gérer les erreurs réseau (CORS, serveur inaccessible, etc.)
    if (error.code === 'ERR_NETWORK' || !error.response) {
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error'
      
      if (isNetworkError) {
        console.error('Erreur réseau détectée:', {
          code: error.code,
          message: error.message,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        })
        
        // Suggestions pour résoudre le problème
        const suggestions = [
          '1. Vérifiez que le serveur Laravel est démarré (php artisan serve)',
          '2. Vérifiez que l\'API est accessible sur http://localhost:8000/api',
          '3. Vérifiez la configuration CORS dans Laravel (voir CORS_SETUP.md)',
          '4. Essayez de désactiver withCredentials dans lib/axios.ts si problème CORS',
        ]
        
        console.error('Suggestions:', suggestions.join('\n'))
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
