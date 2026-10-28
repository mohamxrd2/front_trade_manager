import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * PNG à 2x pour la netteté (spec) — un noeud DOM déjà rendu (l'aperçu à
 * l'écran), jamais un second rendu séparé.
 *
 * Le logo de l'entreprise est servi par le backend hors de /api/* (route
 * storage/ publique), donc sans en-tête CORS — html-to-image doit alors lire
 * les pixels d'une image cross-origin pour produire le PNG, ce qui "salit"
 * le canvas et fait échouer toPng() avec une SecurityError. Le logo ne doit
 * JAMAIS empêcher de partager/exporter un ticket : en cas d'échec, on
 * retente sans lui plutôt que de faire échouer tout le partage.
 */
export async function renderReceiptPng(node: HTMLElement): Promise<string> {
  try {
    return await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' })
  } catch {
    return toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      filter: (domNode) => !(domNode instanceof HTMLElement && domNode.dataset.receiptLogo === 'true'),
    })
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = /data:(.*);base64/.exec(header)
  const mime = mimeMatch?.[1] || 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export interface ShareReceiptResult {
  /**
   * 'shared' : navigator.share a pris le relais (WhatsApp, SMS…) — l'OS montre déjà son propre retour.
   * 'downloaded' : repli fichier téléchargé (la plupart des navigateurs ordinateur) — l'appelant DOIT
   * afficher une confirmation, sinon rien ne semble se produire visuellement.
   * 'cancelled' : l'utilisateur a fermé lui-même la feuille de partage — pas une erreur, rien à afficher.
   */
  outcome: 'shared' | 'downloaded' | 'cancelled'
}

/**
 * "Partager" du ticket — PNG à 2x, navigator.share({ files }) quand
 * disponible (mobile : WhatsApp, SMS…), sinon téléchargement direct du
 * fichier (la plupart des navigateurs ordinateur ne supportent pas le
 * partage de fichiers). Nom de fichier : ticket-{code}.png.
 */
export async function shareReceiptImage(node: HTMLElement, code: string, shareTitle: string): Promise<ShareReceiptResult> {
  const dataUrl = await renderReceiptPng(node)
  const filename = `ticket-${code}.png`
  const file = dataUrlToFile(dataUrl, filename)

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return { outcome: 'shared' }
    } catch (error) {
      // AbortError = l'utilisateur a annulé la feuille de partage — pas une erreur, rien à faire.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { outcome: 'cancelled' }
      }
      // Tout autre échec (API indisponible en pratique malgré canShare) : repli téléchargement.
      downloadDataUrl(dataUrl, filename)
      return { outcome: 'downloaded' }
    }
  }

  downloadDataUrl(dataUrl, filename)
  return { outcome: 'downloaded' }
}

/** Export PDF — en option (spec), à côté du PNG : même image, encapsulée dans un PDF à la largeur du ticket (58/80mm). */
export async function exportReceiptPdf(node: HTMLElement, code: string, widthMm: 58 | 80): Promise<void> {
  const dataUrl = await renderReceiptPng(node)
  const rect = node.getBoundingClientRect()
  const heightMm = (rect.height / rect.width) * widthMm

  const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] })
  doc.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm)
  doc.save(`ticket-${code}.pdf`)
}
