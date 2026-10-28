import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/** PNG à 2x pour la netteté (spec) — un noeud DOM déjà rendu (l'aperçu à l'écran), jamais un second rendu séparé. */
export async function renderReceiptPng(node: HTMLElement): Promise<string> {
  return toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' })
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
  /** `true` si navigator.share a pris le relais (WhatsApp, SMS…), `false` si on est retombé sur un téléchargement direct. */
  shared: boolean
}

/**
 * "Partager" du ticket — PNG à 2x, navigator.share({ files }) quand
 * disponible (mobile : WhatsApp, SMS…), sinon téléchargement direct du
 * fichier. Nom de fichier : ticket-{code}.png.
 */
export async function shareReceiptImage(node: HTMLElement, code: string, shareTitle: string): Promise<ShareReceiptResult> {
  const dataUrl = await renderReceiptPng(node)
  const filename = `ticket-${code}.png`
  const file = dataUrlToFile(dataUrl, filename)

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return { shared: true }
    } catch (error) {
      // AbortError = l'utilisateur a annulé la feuille de partage — pas une erreur, rien à faire.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { shared: false }
      }
      // Tout autre échec (API indisponible en pratique malgré canShare) : repli téléchargement.
      downloadDataUrl(dataUrl, filename)
      return { shared: false }
    }
  }

  downloadDataUrl(dataUrl, filename)
  return { shared: false }
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
