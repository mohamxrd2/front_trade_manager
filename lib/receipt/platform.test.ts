import { describe, expect, test } from 'vitest'

import { canAutoPrint, canUseAirPrint, choosePrintMode, detectIOS, isShareOnlyPlatform } from './platform'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

describe('detectIOS', () => {
  test('iPhone', () => expect(detectIOS({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true))
  test('iPad qui se présente comme un Mac (écran tactile)', () =>
    expect(detectIOS({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true))
  test('vrai Mac (sans écran tactile) : non', () =>
    expect(detectIOS({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false))
  test('Android : non', () => expect(detectIOS({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false))
})

describe('choix du mode d’impression', () => {
  const ios = { ios: true, standalone: false, bluetooth: false }
  const iosHome = { ios: true, standalone: true, bluetooth: false }
  const android = { ios: false, standalone: false, bluetooth: true }

  test('iPhone (Safari ou écran d’accueil) : partage, même si Bluetooth était le mode par défaut', () => {
    expect(choosePrintMode(ios, 'bluetooth')).toBe('share')
    expect(choosePrintMode(iosHome, 'classic')).toBe('share')
  })

  test('Android : Bluetooth si choisi et disponible, sinon impression classique', () => {
    expect(choosePrintMode(android, 'bluetooth')).toBe('bluetooth')
    expect(choosePrintMode({ ...android, bluetooth: false }, 'bluetooth')).toBe('classic')
    expect(choosePrintMode(android, 'classic')).toBe('classic')
  })

  test('AirPrint seulement dans Safari, jamais en mode écran d’accueil ni hors iOS', () => {
    expect(canUseAirPrint(ios)).toBe(true)
    expect(canUseAirPrint(iosHome)).toBe(false)
    expect(canUseAirPrint(android)).toBe(false)
  })

  test('impression automatique désactivée sur iOS sans Bluetooth', () => {
    expect(canAutoPrint(ios)).toBe(false)
    expect(canAutoPrint(android)).toBe(true)
  })

  test('iPhone avec Bluetooth (navigateur Bluefy) : imprimante connectée comme sur Android', () => {
    const bluefy = { ios: true, standalone: false, bluetooth: true }
    expect(choosePrintMode(bluefy, 'bluetooth')).toBe('bluetooth')
    expect(isShareOnlyPlatform(bluefy)).toBe(false)
    expect(canAutoPrint(bluefy)).toBe(true)
    expect(isShareOnlyPlatform(ios)).toBe(true)
  })
})
