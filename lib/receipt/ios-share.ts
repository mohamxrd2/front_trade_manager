import type { PlatformInfo } from './platform'

/**
 * Partage du ticket sur iPhone. Safari n'ouvre la feuille de partage que
 * PENDANT le geste de l'utilisateur : la moindre attente avant
 * navigator.share (rendu de l'image…) le fait refuser (NotAllowedError).
 * D'où : image préparée À L'AVANCE, puis partage appelé immédiatement.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'retry' | 'fallback'

interface ShareNavigator {
  canShare?: (data: ShareData) => boolean
  share?: (data: ShareData) => Promise<void>
}

/**
 * Appelle navigator.share TOUT DE SUITE (aucun await avant) avec le fichier
 * déjà prêt.
 * - 'cancelled' : l'utilisateur a fermé la feuille (AbortError) — rien à afficher ;
 * - 'retry' : Safari a refusé faute de geste (NotAllowedError) — « Touchez à nouveau » ;
 * - 'fallback' : partage de fichier indisponible ou autre erreur — image en plein écran.
 */
export function shareFileNow(file: File, title: string, nav: ShareNavigator = navigator): Promise<ShareOutcome> {
  const data: ShareData = { files: [file], title }
  if (!nav.share || !nav.canShare?.(data)) return Promise.resolve('fallback')
  return nav.share(data).then(
    () => 'shared' as const,
    (error: unknown) => {
      const name = (error as { name?: string } | null)?.name
      if (name === 'AbortError') return 'cancelled' as const
      if (name === 'NotAllowedError') return 'retry' as const
      return 'fallback' as const
    }
  )
}

/** Repli quand le partage échoue : iOS → image en plein écran dans l'app (jamais <a download>, inopérant sur iOS). */
export function receiptFallbackFor(platform: Pick<PlatformInfo, 'ios'>): 'image-modal' | 'download' {
  return platform.ios ? 'image-modal' : 'download'
}
