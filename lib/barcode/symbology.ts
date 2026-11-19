import { hasValidCheckDigit, normalizeBarcode } from './validate'

/**
 * Dessin d'un code-barre en « modules » (true = barre noire, une colonne de
 * largeur 1) — la même suite sert à l'écran (SVG), au partage en image et à
 * l'impression raster (repli quand l'imprimante ignore GS k).
 *
 * - EAN-13 (et UPC-A, qui est un EAN-13 commençant par 0) ;
 * - EAN-8 ;
 * - tout le reste en Code 128 (jeu C pour un nombre pair de chiffres, jeu B sinon).
 */

export type Symbology = 'ean13' | 'ean8' | 'code128'

export interface EncodedBarcode {
  symbology: Symbology
  /** Texte imprimé sous les barres. */
  text: string
  modules: boolean[]
  /** Zones blanches obligatoires, en modules, à gauche et à droite. */
  quietLeft: number
  quietRight: number
  /** Barres de garde (EAN) : plus longues que les autres. */
  guards: boolean[]
}

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const EAN_R = EAN_L.map((p) => [...p].map((c) => (c === '0' ? '1' : '0')).join(''))
const EAN_G = EAN_R.map((p) => [...p].reverse().join(''))
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function bits(pattern: string): boolean[] {
  return [...pattern].map((c) => c === '1')
}

function eanEncode(left: string[], right: string): { modules: boolean[]; guards: boolean[] } {
  const modules: boolean[] = []
  const guards: boolean[] = []
  const push = (pattern: string, guard: boolean) => {
    for (const b of bits(pattern)) {
      modules.push(b)
      guards.push(guard)
    }
  }
  push('101', true)
  left.forEach((p) => push(p, false))
  push('01010', true)
  ;[...right].forEach((d) => push(EAN_R[Number(d)], false))
  push('101', true)
  return { modules, guards }
}

export function encodeEan13(code: string): EncodedBarcode {
  const parity = EAN13_PARITY[Number(code[0])]
  const left = [...code.slice(1, 7)].map((d, i) => (parity[i] === 'L' ? EAN_L : EAN_G)[Number(d)])
  const { modules, guards } = eanEncode(left, code.slice(7))
  return { symbology: 'ean13', text: code, modules, guards, quietLeft: 11, quietRight: 7 }
}

export function encodeEan8(code: string): EncodedBarcode {
  const left = [...code.slice(0, 4)].map((d) => EAN_L[Number(d)])
  const { modules, guards } = eanEncode(left, code.slice(4))
  return { symbology: 'ean8', text: code, modules, guards, quietLeft: 7, quietRight: 7 }
}

/** Largeurs barre/espace des 107 symboles Code 128 (103 = Start A, 104 = Start B, 105 = Start C, 106 = Stop). */
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104
const START_C = 105
const STOP = 106

/** Valeurs Code 128 (start + données + clé + stop) — exportées pour les tests. */
export function code128Values(text: string): number[] {
  const useC = /^\d+$/.test(text) && text.length % 2 === 0
  const data = useC
    ? Array.from({ length: text.length / 2 }, (_, i) => Number(text.slice(i * 2, i * 2 + 2)))
    : [...text].map((c) => {
        const code = c.charCodeAt(0)
        if (code < 32 || code > 126) throw new Error(`Caractère non encodable en Code 128 : ${c}`) // i18n:allow — erreur de programmation, jamais affichée
        return code - 32
      })
  const start = useC ? START_C : START_B
  const checksum = data.reduce((sum, value, i) => sum + value * (i + 1), start) % 103
  return [start, ...data, checksum, STOP]
}

export function encodeCode128(text: string): EncodedBarcode {
  const modules: boolean[] = []
  for (const value of code128Values(text)) {
    let bar = true
    for (const width of CODE128[value]) {
      for (let i = 0; i < Number(width); i++) modules.push(bar)
      bar = !bar
    }
  }
  return { symbology: 'code128', text, modules, guards: modules.map(() => false), quietLeft: 10, quietRight: 10 }
}

/** Le bon dessin pour un code déjà validé. */
export function encodeBarcode(raw: string): EncodedBarcode {
  const code = normalizeBarcode(raw)
  if (/^\d{13}$/.test(code) && hasValidCheckDigit(code)) return encodeEan13(code)
  if (/^\d{12}$/.test(code) && hasValidCheckDigit(code)) return { ...encodeEan13('0' + code), text: code }
  if (/^\d{8}$/.test(code) && hasValidCheckDigit(code)) return encodeEan8(code)
  // UPC-E et le reste : Code 128, relu à l'identique (8 chiffres compris).
  return encodeCode128(code)
}
