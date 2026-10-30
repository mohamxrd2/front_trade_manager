import { stripDiacritics } from '../diacritics-fallback'

/**
 * Tables de caractères des imprimantes thermiques ESC/POS.
 *
 * Constat sur imprimante réelle : la commande ESC t 19 (CP858) envoyée par
 * l'ancien encodeur était ignorée — l'imprimante restait en CP437. Les
 * accents s'imprimaient quand même (é, è, à, ç… ont le MÊME octet en CP437,
 * CP850 et CP858), mais « × » (0x9E en CP858) sortait « ₧ » (0x9E en CP437).
 * D'où un réglage explicite, CP437 par défaut, et la bonne commande ESC t.
 */
export type PrinterCharset = 'cp437' | 'cp850' | 'cp858' | 'ascii'

export const PRINTER_CHARSETS: PrinterCharset[] = ['cp437', 'cp850', 'cp858', 'ascii']

export const DEFAULT_PRINTER_CHARSET: PrinterCharset = 'cp437'

/** n de la commande ESC t n (numérotation Epson, reprise par la quasi-totalité des clones). */
export const ESC_T_CODE: Record<PrinterCharset, number> = {
  cp437: 0,
  cp850: 2,
  cp858: 19,
  ascii: 0,
}

// Lettres (et quelques signes) de la moitié haute, communs aux trois tables.
const COMMON_LETTERS: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87,
  ê: 0x88, ë: 0x89, è: 0x8a, ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, Å: 0x8f,
  É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97,
  ÿ: 0x98, Ö: 0x99, Ü: 0x9a,
  á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5,
}

// CP850/CP858 ajoutent les majuscules accentuées (CP437 ne les a pas).
const CP850_EXTRA: Record<string, number> = {
  Á: 0xb5, Â: 0xb6, À: 0xb7, ã: 0xc6, Ã: 0xc7, Ê: 0xd2, Ë: 0xd3, È: 0xd4,
  Í: 0xd6, Î: 0xd7, Ï: 0xd8, Ì: 0xde, Ó: 0xe0, Ô: 0xe2, Ò: 0xe3, õ: 0xe4,
  Õ: 0xe5, Ú: 0xe9, Û: 0xea, Ù: 0xeb, ý: 0xec, Ý: 0xed,
}

const TABLES: Record<PrinterCharset, Record<string, number>> = {
  cp437: COMMON_LETTERS,
  cp850: { ...COMMON_LETTERS, ...CP850_EXTRA },
  cp858: { ...COMMON_LETTERS, ...CP850_EXTRA },
  ascii: {},
}

/** Octets autorisés pour du TEXTE dans cette table (ASCII imprimable + ses lettres). */
export function allowedTextBytes(charset: PrinterCharset): Set<number> {
  const allowed = new Set<number>()
  for (let b = 0x20; b <= 0x7e; b++) allowed.add(b)
  for (const byte of Object.values(TABLES[charset])) allowed.add(byte)
  return allowed
}

/**
 * Normalise le texte AVANT l'encodage ESC/POS (l'aperçu à l'écran et
 * l'image partagée gardent leur format) :
 * - tous les espaces spéciaux (U+202F fine insécable des milliers en
 *   fr-FR, U+00A0 insécable, U+2009…) → espace normal ;
 * - symboles hors ASCII qui ne sont pas des lettres → équivalent ASCII
 *   (« × » → « x », « · » → « - », guillemets, tirets, « … », « ° », « € »).
 */
export function normalizeForPrinter(text: string): string {
  return text
    .replace(/[   -   　]/g, ' ')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/[×✕✖]/g, 'x')
    .replace(/[·•∙]/g, '-')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/°/g, 'o')
    .replace(/€/g, 'EUR')
}

/** Texte → octets dans la table choisie ; un caractère absent retombe sur sa version sans accent, sinon « ? ». */
export function encodeTextForCharset(text: string, charset: PrinterCharset): number[] {
  const table = TABLES[charset]
  const bytes: number[] = []
  for (const char of normalizeForPrinter(text)) {
    const code = char.codePointAt(0) ?? 0x3f
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code)
      continue
    }
    if (table[char] !== undefined) {
      bytes.push(table[char])
      continue
    }
    for (const fallback of stripDiacritics(char)) {
      const fallbackCode = fallback.codePointAt(0) ?? 0x3f
      bytes.push(fallbackCode >= 0x20 && fallbackCode <= 0x7e ? fallbackCode : 0x3f)
    }
  }
  return bytes
}
