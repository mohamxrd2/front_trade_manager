'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { loginUser, logoutUser, getUser, hasToken, getUserFromStorage } from '@/services/auth'

// Types pour les données utilisateur
interface User {
  id: string
  first_name: string
  last_name: string
  username: string
  email: string
  company_share?: string
  profile_image?: string | null
  provider?: string
  provider_id?: string | null
  email_verified_at?: string | null
  created_at?: string
  updated_at?: string
  total_articles?: number
  total_low_stock?: number
  total_stock_value?: number
  total_remaining_quantity?: number
  total_sale?: number
  total_expense?: number
  calculated_wallet?: number
  wallet?: number
}

// Types pour les credentials de connexion
interface LoginCredentials {
  login: string
  password: string
  remember?: boolean
}

// Types pour le contexte d'authentification
interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; error?: string }>
  logout: () => Promise<{ success: boolean }>
  fetchUser: () => Promise<{ success: boolean; user?: User; error?: string }>
  updateUser: (userData: User) => void
}

// Créer le contexte d'authentification
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Hook personnalisé pour utiliser le contexte d'authentification
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return context
}

// Props pour AuthProvider
interface AuthProviderProps {
  children: ReactNode
}

// Provider du contexte d'authentification
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // Initialiser l'état d'authentification au chargement
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Vérifier s'il y a un token dans localStorage
        if (hasToken()) {
          const storedUser = getUserFromStorage()
          const storedToken = localStorage.getItem('auth_token')
          
          if (storedUser && storedToken) {
            // Vérifier la validité du token en récupérant les données utilisateur
            try {
              const userData = await getUser()
              setUser(userData)
              setToken(storedToken)
              setIsAuthenticated(true)
            } catch (error) {
              // Éviter de spammer la console pour des timeouts réseau au démarrage
              if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.debug('InitAuth: impossible de récupérer l’utilisateur:', (error as any)?.message)
              }
              // Nettoyer l'état uniquement si 401 a été retourné (géré dans getUser)
              localStorage.removeItem('auth_token')
              localStorage.removeItem('user_data')
              setUser(null)
              setToken(null)
              setIsAuthenticated(false)
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'authentification:', error)
        setUser(null)
        setToken(null)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // Fonction de connexion
  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      setLoading(true)
      const result = await loginUser(credentials)
      
      if (result.success && result.user && result.token) {
        setUser(result.user)
        setToken(result.token)
        setIsAuthenticated(true)
        return { success: true, user: result.user }
      } else {
        // Retourner l'erreur sans la logger (c'est une erreur attendue)
        return { 
          success: false, 
          error: result.error || 'Erreur de connexion' 
        }
      }
    } catch (error: any) {
      // Seules les erreurs inattendues arrivent ici
      console.error('Erreur inattendue lors de la connexion:', error)
      return { 
        success: false, 
        error: error?.message || 'Erreur de connexion' 
      }
    } finally {
      setLoading(false)
    }
  }

  // Fonction de déconnexion
  const logout = async (): Promise<{ success: boolean }> => {
    try {
      setLoading(true)
      await logoutUser()
      
      setUser(null)
      setToken(null)
      setIsAuthenticated(false)
      
      return { success: true }
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
      // Même en cas d'erreur, nettoyer l'état local
      setUser(null)
      setToken(null)
      setIsAuthenticated(false)
      
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour récupérer les données utilisateur
  const fetchUser = async (): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      setLoading(true)
      const userData = await getUser()
      setUser(userData)
      return { success: true, user: userData }
    } catch (error: any) {
      console.error('Erreur lors de la récupération des données utilisateur:', error)
      return { 
        success: false, 
        error: error?.message || 'Erreur lors de la récupération des données' 
      }
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour mettre à jour les données utilisateur
  const updateUser = (userData: User): void => {
    setUser(userData)
    localStorage.setItem('user_data', JSON.stringify(userData))
    
    // Récupérer le token depuis localStorage et mettre à jour l'état d'authentification
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      setToken(storedToken)
      setIsAuthenticated(true)
    }
  }

  // Valeur du contexte
  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    fetchUser,
    updateUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Export du type User pour utilisation dans d'autres fichiers
export type { User, LoginCredentials, AuthContextType }
