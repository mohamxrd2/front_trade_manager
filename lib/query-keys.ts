/**
 * Fabrique unique de clés TanStack Query — AUCUNE clé ne doit être écrite à
 * la main ailleurs dans l'app (ni dans un `useQuery`, ni dans un
 * `invalidateQueries`). Toujours importer depuis ce fichier :
 *
 *   import { keys } from '@/lib/query-keys'
 *   useQuery({ queryKey: keys.products.list(), ... })
 *   queryClient.invalidateQueries({ queryKey: keys.products.all })
 *
 * Chaque domaine expose :
 * - `all`      : la racine du domaine (invalide TOUT ce domaine d'un coup)
 * - `list(..)` / `detail(id)` : clés précises pour un `useQuery` donné
 *
 * `invalidateQueries({ queryKey: keys.x.all })` invalide aussi bien
 * `keys.x.list()` que `keys.x.detail(id)` grâce au préfixe partagé — c'est
 * la hiérarchie de clés standard de TanStack Query.
 */

export const keys = {
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    stockHistory: (id: string) => ['products', 'stock-history', id] as const,
  },

  userStats: {
    all: ['user-stats'] as const,
  },

  invoices: {
    all: ['invoices'] as const,
    list: (filters?: Record<string, unknown>) => ['invoices', 'list', filters ?? {}] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    dashboard: () => ['invoices', 'dashboard'] as const,
  },

  clients: {
    all: ['clients'] as const,
    list: (filters?: Record<string, unknown>) => ['clients', 'list', filters ?? {}] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
  },

  wallet: {
    all: ['wallet'] as const,
    summary: (period?: string) => ['wallet', 'summary', period ?? 'all'] as const,
    transactions: (filters?: Record<string, unknown>) => ['wallet', 'transactions', filters ?? {}] as const,
  },

  analytics: {
    all: ['analytics'] as const,
    overview: (period: string) => ['analytics', 'overview', period] as const,
    kpis: (period: string) => ['analytics', 'kpis', period] as const,
    comparisons: (period: string) => ['analytics', 'comparisons', period] as const,
    category: (period: string) => ['analytics', 'category', period] as const,
    transactions: (period: string) => ['analytics', 'transactions', period] as const,
    forecast: () => ['analytics', 'forecast'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    overview: (period: string) => ['dashboard', 'overview', period] as const,
    comparisons: (period: string) => ['dashboard', 'comparisons', period] as const,
    kpis: (period: string) => ['dashboard', 'kpis', period] as const,
    trends: (period: string) => ['dashboard', 'trends', period] as const,
    categoryDonut: (period: string) => ['dashboard', 'category-donut', period] as const,
    transactions: () => ['dashboard', 'transactions'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    unread: () => ['notifications', 'unread-count'] as const,
  },

  collaborators: {
    all: ['collaborators'] as const,
  },

  settings: {
    all: ['settings'] as const,
    user: () => ['settings', 'user'] as const,
    company: () => ['settings', 'company'] as const,
  },

  onboarding: {
    status: () => ['onboarding', 'status'] as const,
  },
} as const
