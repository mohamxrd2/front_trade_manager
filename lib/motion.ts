/**
 * Variants framer-motion partagés par components/landing/* — une seule
 * courbe d'easing et une seule logique de "fondu + montée + flou" dans tout
 * le site, pour que toutes les révélations se sentent pareil.
 *
 * Respect de prefers-reduced-motion : géré globalement par
 * <MotionConfig reducedMotion="user"> dans app/(marketing)/layout.tsx — pas
 * besoin de vérifier useReducedMotion() dans chaque composant, motion
 * remplace automatiquement toute transition par un fondu instantané.
 */

export const EASE = [0.2, 0.8, 0.2, 1] as const

/** Fondu + montée + flou — l'animation de base de toute la page (badge, titres, cartes, boutons). */
export const fadeUpBlur = {
  hidden: { opacity: 0, filter: 'blur(12px)', y: 24 },
  visible: { opacity: 1, filter: 'blur(0px)', y: 0 },
}

/** Variante sans flou (listes de cartes nombreuses — moins coûteux à grande échelle). */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export function staggerContainer(staggerSeconds = 0.12, delaySeconds = 0) {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: staggerSeconds, delayChildren: delaySeconds },
    },
  }
}

export const revealViewport = { once: true, amount: 0.25 } as const

export const transitionBase = { duration: 0.6, ease: EASE }
