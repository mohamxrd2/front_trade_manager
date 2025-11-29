/**
 * Fonction utilitaire pour vérifier si une erreur doit être ignorée silencieusement
 * (par exemple, pendant la déconnexion ou la redirection)
 */
export function isSilentError(error: unknown): boolean {
  if (!error) return false
  
  const errorMessage = (error as Error)?.message || ''
  const silent = (error as Error & { silent?: boolean })?.silent
  const isLoggingOut = (error as Error & { isLoggingOut?: boolean })?.isLoggingOut
  
  // Vérifier si c'est une erreur 401 qui doit être silencieuse
  const axiosError = error as { response?: { status?: number } }
  const is401 = axiosError?.response?.status === 401
  
  // Si c'est une 401 et que l'erreur est marquée comme silencieuse, l'ignorer
  if (is401 && silent) {
    return true
  }
  
  return (
    errorMessage.includes('Unauthorized during logout') ||
    errorMessage.includes('Ignoring') ||
    errorMessage.includes('Redirecting to login') ||
    errorMessage.includes('(silent)') ||
    silent === true ||
    isLoggingOut === true
  )
}

/**
 * Fonction pour gérer les erreurs 401 en vérifiant si elles doivent être ignorées
 */
export function handle401Error(error: unknown, defaultMessage = 'Non authentifié'): never {
  if (isSilentError(error)) {
    // Re-lancer l'erreur silencieuse telle quelle
    throw error
  }
  
  // Erreur 401 normale, lancer avec le message par défaut
  throw new Error(defaultMessage)
}

