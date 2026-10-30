import type { ReceiptModel } from './build-receipt'
import { DEFAULT_PRINTER_CHARSET, ESC_T_CODE, encodeTextForCharset, type PrinterCharset } from './escpos/charsets'
import { printerDotsFor, qrBitmap, rasterCommands, toMonochrome, type ImageDataLike } from './escpos/raster'

/**
 * Encode un ReceiptModel (le MÊME modèle neutre que l'aperçu, l'impression
 * classique et l'image partagée) en commandes ESC/POS pour l'impression
 * Bluetooth.
 *
 * Encodeur écrit à la main (et non plus @point-of-sale/receipt-printer-encoder)
 * pour maîtriser chaque octet — un ticket réel sortait « 130?000 FCFA »,
 * « 1 ₧ 130 000 », un en-tête illisible et un « 2 » parasite :
 * - table de caractères choisie par l'utilisateur, avec SA commande ESC t
 *   envoyée une seule fois à l'initialisation (voir escpos/charsets.ts) ;
 * - texte normalisé (espaces insécables des milliers → espace, « × » → « x ») ;
 * - logo et QR code désactivés par défaut, et imprimés en image raster
 *   (GS v 0) quand on les active — plus de GS ( k ;
 * - nom de l'entreprise toujours en tête, gras et double hauteur ;
 * - « large » = double HAUTEUR seulement (la double largeur faisait déborder
 *   « TOTAL 130 000 FCFA » sur 58 mm).
 *
 * Le résultat est une liste de BLOCS : chaque bloc est une commande (ou une
 * ligne de texte avec ses commandes de mise en forme) complète, jamais plus
 * grande que `maxBlockBytes` — packetizeBlocks() ne les coupe jamais.
 */

export interface EscPosEncodeOptions {
  /** Table de caractères de l'imprimante (réglage « Table de caractères »). */
  charset?: PrinterCharset
  /** Coupe papier en fin de ticket — désactivé par défaut (beaucoup d'imprimantes n'ont pas de massicot). */
  cutPaper?: boolean
  /** Imprimer le logo (réglage « Imprimer le logo », désactivé par défaut). */
  printLogo?: boolean
  /** Logo déjà chargé et mis à l'échelle par l'appelant (navigateur) — absent : pas de logo, jamais un ticket qui échoue. */
  logoImage?: ImageDataLike | null
  /** Imprimer le QR code (réglage « Imprimer le QR code », désactivé par défaut). */
  printQr?: boolean
  /** Nom à imprimer si celui de l'entreprise est vide (nom du compte). */
  companyNameFallback?: string
  /** Taille maximale d'un bloc — la même que celle des paquets Bluetooth. */
  maxBlockBytes?: number
}

export const DEFAULT_MAX_BLOCK_BYTES = 160

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const ALIGN: Record<'left' | 'center' | 'right', number> = { left: 0, center: 1, right: 2 }

/** Une ligne de texte avec sa mise en forme, remise à zéro à la fin : un seul bloc. */
function textBlock(
  text: string,
  charset: PrinterCharset,
  style: { align?: 'left' | 'center' | 'right'; bold?: boolean; doubleHeight?: boolean } = {}
): Uint8Array {
  const bytes: number[] = [ESC, 0x61, ALIGN[style.align ?? 'left']]
  if (style.bold) bytes.push(ESC, 0x45, 1)
  if (style.doubleHeight) bytes.push(GS, 0x21, 0x01)
  bytes.push(...encodeTextForCharset(text, charset), LF)
  if (style.doubleHeight) bytes.push(GS, 0x21, 0x00)
  if (style.bold) bytes.push(ESC, 0x45, 0)
  return Uint8Array.from(bytes)
}

export function encodeReceiptEscPosBlocks(model: ReceiptModel, options: EscPosEncodeOptions = {}): Uint8Array[] {
  const {
    charset = DEFAULT_PRINTER_CHARSET,
    cutPaper = false,
    printLogo = false,
    logoImage = null,
    printQr = false,
    companyNameFallback = '',
    maxBlockBytes = DEFAULT_MAX_BLOCK_BYTES,
  } = options
  const paperDots = printerDotsFor(model.width)
  const blocks: Uint8Array[] = []

  // ESC @ (réinitialisation) puis ESC t n (table) — une seule fois, avant tout texte.
  blocks.push(Uint8Array.from([ESC, 0x40, ESC, 0x74, ESC_T_CODE[charset]]))

  let nameWritten = false
  const writeName = (name: string) => {
    blocks.push(textBlock(name, charset, { align: 'center', bold: true, doubleHeight: true }))
    nameWritten = true
  }

  for (const row of model.rows) {
    switch (row.kind) {
      case 'logo':
        if (printLogo && logoImage) {
          blocks.push(...rasterCommands(toMonochrome(logoImage), paperDots, maxBlockBytes))
        }
        break

      case 'text':
        if (row.role === 'company-name') {
          writeName(row.text.trim() || companyNameFallback)
          break
        }
        blocks.push(textBlock(row.text, charset, { align: row.align, bold: row.bold, doubleHeight: row.size === 'large' }))
        break

      case 'columns':
        blocks.push(textBlock(row.text, charset))
        break

      case 'separator':
        blocks.push(textBlock(row.text, charset, { align: 'center' }))
        break

      case 'spacer':
        blocks.push(Uint8Array.from([LF]))
        break

      case 'qr':
        if (printQr) {
          blocks.push(...rasterCommands(qrBitmap(row.payload, paperDots >= 576 ? 7 : 5), paperDots, maxBlockBytes))
        }
        break

      default:
        break
    }
  }

  // Ticket sans ligne de nom (ex. ticket de test) : le nom reste imprimé en tête.
  if (!nameWritten && companyNameFallback) {
    blocks.splice(1, 0, textBlock(companyNameFallback, charset, { align: 'center', bold: true, doubleHeight: true }))
  }

  blocks.push(Uint8Array.from([LF, LF, LF]))
  if (cutPaper) blocks.push(Uint8Array.from([GS, 0x56, 0x00]))

  return blocks
}

/** Les blocs mis bout à bout (tests, diagnostic). */
export function encodeReceiptEscPos(model: ReceiptModel, options: EscPosEncodeOptions = {}): Uint8Array {
  const blocks = encodeReceiptEscPosBlocks(model, options)
  const out = new Uint8Array(blocks.reduce((sum, block) => sum + block.length, 0))
  let offset = 0
  for (const block of blocks) {
    out.set(block, offset)
    offset += block.length
  }
  return out
}

/**
 * Page de test des caractères (Paramètres → Ticket de caisse → Imprimante) :
 * accents, nombre avec séparateur de milliers et « x » dans la table choisie.
 */
export function encodeCharsetTestPage(
  width: '58mm' | '80mm',
  charset: PrinterCharset,
  lines: { title: string; charsetName: string; accents: string; amount: string; multiply: string }
): Uint8Array[] {
  const blocks: Uint8Array[] = [Uint8Array.from([ESC, 0x40, ESC, 0x74, ESC_T_CODE[charset]])]
  blocks.push(textBlock(lines.title, charset, { align: 'center', bold: true, doubleHeight: true }))
  blocks.push(textBlock(lines.charsetName, charset, { align: 'center' }))
  blocks.push(textBlock('-'.repeat(width === '80mm' ? 48 : 32), charset, { align: 'center' }))
  blocks.push(textBlock(lines.accents, charset))
  blocks.push(textBlock(lines.amount, charset))
  blocks.push(textBlock(lines.multiply, charset))
  blocks.push(Uint8Array.from([LF, LF, LF]))
  return blocks
}
