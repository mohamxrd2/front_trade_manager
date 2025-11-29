import { create } from 'zustand'
import type { UserStats } from '../services/articles'
import type { Article } from '../services/articles'

/**
 * Store global pour garder les dernières données valides
 * Évite l'affichage "0" temporaire pendant les revalidations
 * 
 * Le store Zustand garde l'état en mémoire entre les navigations
 * tant que l'application ne se recharge pas complètement
 */
interface DataCacheState {
  userStats: UserStats | null
  articles: Article[]
  setUserStats: (stats: UserStats | null) => void
  setArticles: (articles: Article[]) => void
}

export const useDataCache = create<DataCacheState>((set) => ({
  userStats: null,
  articles: [],
  setUserStats: (stats) => {
    // Ne mettre à jour que si stats existe (ne pas écraser avec null)
    if (stats) {
      set({ userStats: stats })
    }
  },
  setArticles: (articles) => {
    // Ne mettre à jour que si articles est un tableau non vide
    if (Array.isArray(articles) && articles.length > 0) {
      set({ articles })
    }
  },
}))

