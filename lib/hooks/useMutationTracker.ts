import { create } from 'zustand'

/**
 * Store global pour tracker les mutations en cours
 * Permet de savoir si une mutation vient d'avoir lieu pour afficher le skeleton
 */
interface MutationTrackerState {
  isMutating: boolean
  setMutating: (value: boolean) => void
}

export const useMutationTracker = create<MutationTrackerState>((set) => ({
  isMutating: false,
  setMutating: (value: boolean) => set({ isMutating: value }),
}))

/**
 * Marque qu'une mutation est en cours
 * À appeler avant d'invalider les caches après une mutation
 */
export function startMutation() {
  useMutationTracker.getState().setMutating(true)
}

/**
 * Marque qu'une mutation est terminée
 * À appeler après que les données ont été mises à jour
 */
export function endMutation() {
  // Délai pour permettre au skeleton de s'afficher brièvement
  setTimeout(() => {
    useMutationTracker.getState().setMutating(false)
  }, 100)
}

