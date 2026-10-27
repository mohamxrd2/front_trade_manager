import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Panier de la nouvelle vente multi-articles (étape 3 du chantier
 * "paniers multi-articles") — gardé en sessionStorage : une coupure ou un
 * rechargement de l'onglet ne vide pas le panier en cours (contrairement à
 * localStorage, sessionStorage se vide bien à la fermeture de l'onglet, ce
 * qui est le comportement voulu — pas un panier qui traîne indéfiniment).
 * Vidé explicitement après une vente validée (clear()).
 *
 * `id` de chaque ligne = `${articleId}:${variationId ?? ''}` — fusion
 * automatique par la Map sous-jacente : ajouter un article/variation déjà
 * présent incrémente sa quantité au lieu de dupliquer une ligne (voir
 * addLine ci-dessous), exactement la règle produit demandée.
 */
export interface CartLine {
  /** `${articleId}:${variationId ?? ''}` — jamais envoyé au serveur, sert de clé React + de fusion. */
  id: string
  articleId: string
  variationId: string | null
  articleName: string
  variationName: string | null
  unitPrice: number
  quantity: number
  /** Stock restant au moment de l'ajout — plafond du stepper ; le serveur revérifie de toute façon au verrou. */
  maxStock: number
}

function lineId(articleId: string, variationId: string | null): string {
  return `${articleId}:${variationId ?? ''}`
}

interface CartState {
  lines: CartLine[]
  /** Généré à l'ouverture de l'encaissement, réutilisé pour tous les essais de CETTE soumission (voir wallet/new/page.tsx). */
  idempotencyKey: string | null

  addLine: (line: { articleId: string; variationId: string | null; articleName: string; variationName: string | null; unitPrice: number; maxStock: number }) => void
  updateQuantity: (id: string, quantity: number) => void
  updatePrice: (id: string, unitPrice: number) => void
  removeLine: (id: string) => void
  clear: () => void
  ensureIdempotencyKey: () => string
  resetIdempotencyKey: () => void
  /** Après un 422 "Stock insuffisant" : ramène chaque ligne en cause à son stock disponible. */
  clampLineToStock: (id: string, available: number) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      idempotencyKey: null,

      addLine: (input) => {
        const id = lineId(input.articleId, input.variationId)
        set((state) => {
          const existing = state.lines.find((l) => l.id === id)
          if (existing) {
            const nextQty = Math.min(existing.quantity + 1, Math.max(existing.maxStock, existing.quantity))
            return {
              lines: state.lines.map((l) => (l.id === id ? { ...l, quantity: nextQty } : l)),
            }
          }
          return {
            lines: [
              ...state.lines,
              {
                id,
                articleId: input.articleId,
                variationId: input.variationId,
                articleName: input.articleName,
                variationName: input.variationName,
                unitPrice: input.unitPrice,
                quantity: 1,
                maxStock: input.maxStock,
              },
            ],
          }
        })
      },

      updateQuantity: (id, quantity) => {
        set((state) => ({
          lines: state.lines.map((l) => {
            if (l.id !== id) return l
            const capped = Math.max(1, Math.min(quantity, Math.max(l.maxStock, 1)))
            return { ...l, quantity: capped }
          }),
        }))
      },

      updatePrice: (id, unitPrice) => {
        set((state) => ({
          lines: state.lines.map((l) => (l.id === id ? { ...l, unitPrice: Math.max(0, unitPrice) } : l)),
        }))
      },

      removeLine: (id) => {
        set((state) => ({ lines: state.lines.filter((l) => l.id !== id) }))
      },

      clear: () => {
        set({ lines: [], idempotencyKey: null })
      },

      ensureIdempotencyKey: () => {
        const existing = get().idempotencyKey
        if (existing) return existing
        const next = crypto.randomUUID()
        set({ idempotencyKey: next })
        return next
      },

      resetIdempotencyKey: () => {
        set({ idempotencyKey: null })
      },

      clampLineToStock: (id, available) => {
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === id ? { ...l, maxStock: available, quantity: Math.min(l.quantity, Math.max(available, 0)) } : l
          ),
        }))
      },
    }),
    {
      name: 'waelly-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

/** Total du panier (somme des sous-lignes) — dérivé, jamais stocké. */
export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}

/** Nombre d'articles (somme des quantités, pas du nombre de lignes) — "3 articles" dans le pied de page. */
export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
