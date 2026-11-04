/**
 * Impression du ticket selon l'appareil. Sur iPhone/iPad, aucun navigateur
 * n'a Web Bluetooth et window.print() passe par AirPrint (ignoré par la
 * plupart des imprimantes thermiques ; sans effet en mode écran d'accueil) :
 * on y passe par le PARTAGE de l'image du ticket (WhatsApp, application de
 * l'imprimante, ou « Imprimer »).
 */
export interface PlatformInfo {
  ios: boolean
  /** Application ajoutée à l'écran d'accueil (display-mode: standalone). */
  standalone: boolean
  bluetooth: boolean
}

export type ReceiptPrintMode = 'share' | 'bluetooth' | 'classic'

interface NavigatorLike {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

/** iPhone, iPod, iPad — y compris un iPad qui se présente comme un Mac (écran tactile). */
export function detectIOS(nav: NavigatorLike): boolean {
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true
  const touch = (nav.maxTouchPoints ?? 0) > 1
  return touch && (nav.platform === 'MacIntel' || /Macintosh/.test(nav.userAgent))
}

export function choosePrintMode(platform: PlatformInfo, defaultMode: 'bluetooth' | 'classic'): ReceiptPrintMode {
  if (platform.ios) return 'share'
  if (defaultMode === 'bluetooth' && platform.bluetooth) return 'bluetooth'
  return 'classic'
}

/** AirPrint (window.print()) seulement dans Safari : sans effet en mode écran d'accueil. */
export function canUseAirPrint(platform: PlatformInfo): boolean {
  return platform.ios && !platform.standalone
}

/** Impression automatique après une vente : impossible sur iOS (le partage exige un geste). */
export function canAutoPrint(platform: PlatformInfo): boolean {
  return !platform.ios
}

export function getPlatformInfo(): PlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ios: false, standalone: false, bluetooth: false }
  }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return { ios: detectIOS(navigator), standalone, bluetooth: 'bluetooth' in navigator }
}
