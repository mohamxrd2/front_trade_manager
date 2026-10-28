import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/fr'

import { formatMoney } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * buildReceipt() — fonction PURE qui transforme une opération en modèle de
 * ticket neutre (lignes de texte, alignements, gras), indépendant du rendu.
 * Consommée aujourd'hui par ReceiptView (HTML/aperçu/impression/export
 * image), et plus tard par l'impression ESC/POS en Bluetooth (étape 2 du
 * chantier ticket de caisse) — d'où la séparation stricte modèle/rendu.
 *
 * Les lignes "2 × 12 000" / "24 000" sont déjà PADDÉES ici (espaces
 * insérés pour atteindre `charsPerLine`) : une imprimante ESC/POS ne sait
 * pas aligner deux colonnes sur une même ligne nativement, contrairement au
 * centrage/alignement simple d'un texte (géré par `align`, traduisible en
 * commande matérielle plus tard). Le reste du ticket n'a donc PAS besoin de
 * padding manuel, juste d'un indicateur d'alignement.
 */

export type ReceiptWidth = '58mm' | '80mm'

export function charsPerLineFor(width: ReceiptWidth): 32 | 48 {
  return width === '80mm' ? 48 : 32
}

export interface ReceiptTextRow {
  kind: 'text'
  text: string
  align: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'large'
}

/** Ligne à deux colonnes déjà alignée (padding inclus) — ex. "2 × 12 000" / "24 000". */
export interface ReceiptColumnsRow {
  kind: 'columns'
  text: string
}

export interface ReceiptSeparatorRow {
  kind: 'separator'
  text: string
}

export interface ReceiptSpacerRow {
  kind: 'spacer'
}

export interface ReceiptLogoRow {
  kind: 'logo'
  url: string
}

export interface ReceiptQrRow {
  kind: 'qr'
  payload: string
}

export type ReceiptRow =
  | ReceiptTextRow
  | ReceiptColumnsRow
  | ReceiptSeparatorRow
  | ReceiptSpacerRow
  | ReceiptLogoRow
  | ReceiptQrRow

export interface ReceiptModel {
  width: ReceiptWidth
  charsPerLine: 32 | 48
  rows: ReceiptRow[]
}

export interface ReceiptCompanyInfo {
  name: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  taxId?: string | null
}

export interface ReceiptDisplaySettings {
  width: ReceiptWidth
  showLogo: boolean
  showAddress: boolean
  showPhone: boolean
  showTaxId: boolean
  footerMessage?: string | null
  showQr: boolean
  showWaellyMention: boolean
}

export interface ReceiptOperationLine {
  name: string
  variationName?: string | null
  quantity?: number | null
  unitPrice?: number | null
  amount: number
}

export interface ReceiptOperationInput {
  code: string
  /** Date ISO ou objet Date — toujours affichée en fuseau Africa/Abidjan. */
  date: string | Date
  /** Déjà traduit par l'appelant (ex. "Wave", "Espèces") — `null`/absent -> "Non précisé". */
  paymentMethodLabel?: string | null
  totalAmount: number
  amountReceived?: number | null
  changeGiven?: number | null
  clientName?: string | null
  authorName?: string | null
  lines: ReceiptOperationLine[]
}

/** Toutes les chaînes affichées sur le ticket — fournies par l'appelant (via useTranslation()) pour garder buildReceipt pur et testable sans contexte React/i18n. */
export interface ReceiptLabels {
  ticketNumber: string // "Ticket n°"
  cashier: string // "Caissier"
  client: string // "Client"
  total: string // "TOTAL"
  paidBy: string // "Payé par"
  received: string // "Reçu"
  changeGiven: string // "Monnaie rendue"
  duplicate: string // "DUPLICATA"
  paymentMethodUnknown: string // "Non précisé"
  defaultFooter: string // "Merci de votre visite !"
  waellyMention: string // "Waelly"
}

export interface BuildReceiptOptions {
  language: AppLanguage
  currency?: string
  /** Réimpression depuis le détail d'une transaction — affiche "DUPLICATA" sous le numéro. */
  duplicate?: boolean
  labels: ReceiptLabels
}

function amount(value: number, options: BuildReceiptOptions): string {
  return formatMoney(value, options.currency, options.language)
}

/** Découpe greedy par mot — jamais de mot coupé en plein milieu. */
function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > charsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/** "2 × 12 000" à gauche, "24 000" à droite, sur UNE ligne de `charsPerLine` caractères. */
function columnsRow(left: string, right: string, charsPerLine: number): ReceiptColumnsRow {
  if (left.length + right.length >= charsPerLine) {
    return { kind: 'columns', text: `${left} ${right}` }
  }
  return { kind: 'columns', text: left.padEnd(charsPerLine - right.length, ' ') + right }
}

function separatorRow(charsPerLine: number): ReceiptSeparatorRow {
  return { kind: 'separator', text: '-'.repeat(charsPerLine) }
}

export function buildReceipt(
  operation: ReceiptOperationInput,
  company: ReceiptCompanyInfo,
  settings: ReceiptDisplaySettings,
  options: BuildReceiptOptions
): ReceiptModel {
  const charsPerLine = charsPerLineFor(settings.width)
  const { labels } = options
  const rows: ReceiptRow[] = []

  if (settings.showLogo && company.logoUrl) {
    rows.push({ kind: 'logo', url: company.logoUrl })
  }

  rows.push({ kind: 'text', text: company.name, align: 'center', bold: true, size: 'large' })

  if (settings.showAddress && company.address) {
    for (const line of wrapText(company.address, charsPerLine)) {
      rows.push({ kind: 'text', text: line, align: 'center' })
    }
  }
  if (settings.showPhone && company.phone) {
    rows.push({ kind: 'text', text: company.phone, align: 'center' })
  }
  if (settings.showTaxId && company.taxId) {
    rows.push({ kind: 'text', text: company.taxId, align: 'center' })
  }

  rows.push(separatorRow(charsPerLine))

  rows.push({ kind: 'text', text: `${labels.ticketNumber} ${operation.code}`, align: 'center', bold: true })
  if (options.duplicate) {
    rows.push({ kind: 'text', text: labels.duplicate, align: 'center', bold: true })
  }

  const dateTime = dayjs(operation.date)
    .tz('Africa/Abidjan')
    .locale(options.language)
    .format(options.language === 'en' ? 'MMMM D, YYYY · h:mm A' : 'D MMMM YYYY · HH:mm')
  rows.push({ kind: 'text', text: dateTime, align: 'center' })

  if (operation.authorName) {
    rows.push({ kind: 'text', text: `${labels.cashier} : ${operation.authorName}`, align: 'center' })
  }
  if (operation.clientName) {
    rows.push({ kind: 'text', text: `${labels.client} : ${operation.clientName}`, align: 'center' })
  }

  rows.push(separatorRow(charsPerLine))

  for (const line of operation.lines) {
    const label = line.variationName ? `${line.name} · ${line.variationName}` : line.name
    for (const wrapped of wrapText(label, charsPerLine)) {
      rows.push({ kind: 'text', text: wrapped, align: 'left' })
    }
    if (line.quantity != null && line.unitPrice != null) {
      rows.push(columnsRow(`${line.quantity} × ${amount(line.unitPrice, options)}`, amount(line.amount, options), charsPerLine))
    } else {
      rows.push(columnsRow('', amount(line.amount, options), charsPerLine))
    }
  }

  rows.push(separatorRow(charsPerLine))

  rows.push({ kind: 'text', text: `${labels.total} ${amount(operation.totalAmount, options)}`, align: 'center', bold: true, size: 'large' })

  rows.push({
    kind: 'text',
    text: `${labels.paidBy} : ${operation.paymentMethodLabel || labels.paymentMethodUnknown}`,
    align: 'center',
  })
  if (operation.amountReceived != null) {
    rows.push({ kind: 'text', text: `${labels.received} : ${amount(operation.amountReceived, options)}`, align: 'center' })
    rows.push({
      kind: 'text',
      text: `${labels.changeGiven} : ${amount(operation.changeGiven ?? 0, options)}`,
      align: 'center',
    })
  }

  rows.push(separatorRow(charsPerLine))

  const footer = settings.footerMessage?.trim() || labels.defaultFooter
  for (const line of wrapText(footer, charsPerLine)) {
    rows.push({ kind: 'text', text: line, align: 'center' })
  }

  if (settings.showQr) {
    rows.push({ kind: 'qr', payload: operation.code })
  }

  if (settings.showWaellyMention) {
    rows.push({ kind: 'spacer' })
    rows.push({ kind: 'text', text: labels.waellyMention, align: 'center', size: 'normal' })
  }

  return { width: settings.width, charsPerLine, rows }
}
