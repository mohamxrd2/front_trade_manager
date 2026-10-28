import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'

import type { ReceiptModel, ReceiptWidth } from './build-receipt'
import { stripDiacritics } from './diacritics-fallback'

/**
 * Encode un ReceiptModel (le MÊME modèle neutre produit par buildReceipt(),
 * déjà consommé par ReceiptView pour l'aperçu/l'impression classique/le
 * partage) en commandes ESC/POS, prêtes à être envoyées en Bluetooth.
 *
 * Choix de bibliothèque : @point-of-sale/receipt-printer-encoder (MIT,
 * maintenue — successeur officiel du populaire esc-pos-encoder, désormais
 * déprécié au profit de celle-ci). Couvre tout ce dont ce chantier a
 * besoin — gras (ESC E), double taille (GS !), alignement (ESC a), coupe
 * (GS V), page de code (ESC t), QR natif (GS ( k) et image tramée en
 * raster (GS v 0) — sans réinventer un protocole bas niveau réputé
 * pointilleux d'une imprimante à l'autre. La connexion Bluetooth elle-même
 * (voir bluetooth-transport.ts) reste faite main : elle a besoin d'un
 * filtrage de service précis et d'une taille de paquet maîtrisée (cahier
 * des charges), un terrain plus simple et plus prévisible à contrôler
 * soi-même qu'à déléguer.
 *
 * Page de code : CP858 uniquement (pas CP1252 — @point-of-sale/codepage-encoder
 * ne le supporte pas correctement : les caractères accentués y ressortent
 * en "?" au lieu d'être mappés, vérifié empiriquement). CP858 couvre déjà
 * tous les accents français usuels (é è à ç ù â ê î ô û ë ï ü œ) plus le
 * symbole euro, donc aucune perte réelle pour l'usage visé.
 */

export interface EscPosEncodeOptions {
  /** Repli ASCII (accents retirés) pour les imprimantes qui ne reconnaissent pas CP858 — réglage "Mode compatibilité". */
  compatibilityMode?: boolean
  /** Coupe papier en fin de ticket — désactivé par défaut : beaucoup d'imprimantes thermiques bon marché n'ont pas de massicot. */
  cutPaper?: boolean
  /** Logo déjà chargé par l'appelant (contexte navigateur) — absent ou en erreur : la ligne logo est simplement ignorée, jamais un ticket qui échoue. */
  logoImage?: ImageData | HTMLCanvasElement | HTMLImageElement | null
}

function widthPointsFor(width: ReceiptWidth): number {
  return width === '80mm' ? 576 : 384
}

export function encodeReceiptEscPos(model: ReceiptModel, options: EscPosEncodeOptions = {}): Uint8Array {
  const { compatibilityMode = false, cutPaper = false, logoImage = null } = options

  const encoder = new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns: model.charsPerLine,
  })

  const text = (value: string) => (compatibilityMode ? stripDiacritics(value) : value)

  encoder.initialize()
  if (!compatibilityMode) {
    encoder.codepage('cp858')
  }

  for (const row of model.rows) {
    switch (row.kind) {
      case 'logo':
        if (logoImage) {
          try {
            encoder.align('center').image(logoImage, { width: widthPointsFor(model.width), algorithm: 'floydsteinberg' })
          } catch {
            // Logo non décodable dans cet environnement — le reste du ticket s'imprime quand même.
          }
        }
        break

      case 'text': {
        encoder.align(row.align)
        if (row.bold) encoder.bold(true)
        if (row.size === 'large') encoder.size(2, 2)
        encoder.line(text(row.text))
        if (row.size === 'large') encoder.size(1, 1)
        if (row.bold) encoder.bold(false)
        break
      }

      case 'columns':
        encoder.align('left').line(text(row.text))
        break

      case 'separator':
        encoder.align('center').line(row.text)
        break

      case 'spacer':
        encoder.newline()
        break

      case 'qr':
        // GS ( k natif — quasi universellement supporté par les imprimantes
        // ESC/POS modernes. Aucun moyen fiable de détecter le contraire sur
        // une liaison BLE en écriture seule : désactiver le QR dans les
        // réglages reste le repli si une imprimante ne le gère pas.
        encoder.align('center').qrcode(row.payload, { model: 2, size: 6, errorlevel: 'm' })
        break

      default:
        break
    }
  }

  encoder.newline(3)
  if (cutPaper) {
    encoder.cut('full')
  }

  return encoder.encode()
}
