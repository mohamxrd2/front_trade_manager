'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

// Configuration globale de nprogress (une seule fois)
if (typeof window !== 'undefined') {
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.08,
    easing: 'ease',
    speed: 400,
  })
}

export function NavigationProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Démarrer la barre de progression lors du changement de route
    NProgress.start()

    // Fonction pour arrêter la barre de progression
    const handleComplete = () => {
      NProgress.done()
    }

    // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
    const rafId = requestAnimationFrame(() => {
      // Si la page est déjà chargée, attendre un peu pour que la barre soit visible
      if (document.readyState === 'complete') {
        // Délai plus long pour permettre de voir la barre
        const timer = setTimeout(() => {
          handleComplete()
        }, 800)
        return () => clearTimeout(timer)
      } else {
        // Écouter l'événement de chargement de la page
        const loadHandler = () => {
          handleComplete()
        }
        window.addEventListener('load', loadHandler, { once: true })
        
        // Fallback : arrêter après un délai maximum
        const fallbackTimer = setTimeout(() => {
          window.removeEventListener('load', loadHandler)
          handleComplete()
        }, 3000)

        return () => {
          window.removeEventListener('load', loadHandler)
          clearTimeout(fallbackTimer)
        }
      }
    })

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [pathname, searchParams])

  return null
}
