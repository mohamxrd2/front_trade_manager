import { describe, expect, test } from 'vitest'
import { packetizeBytes } from './packetize'

describe('packetizeBytes', () => {
  test('découpe en paquets de la taille demandée (défaut 160 octets)', () => {
    const bytes = new Uint8Array(350).map((_, i) => i % 256)
    const packets = packetizeBytes(bytes)
    expect(packets).toHaveLength(3)
    expect(packets[0]).toHaveLength(160)
    expect(packets[1]).toHaveLength(160)
    expect(packets[2]).toHaveLength(30)
  })

  test('une taille de paquet personnalisée est respectée', () => {
    const bytes = new Uint8Array(100)
    const packets = packetizeBytes(bytes, 32)
    expect(packets.map((p) => p.length)).toEqual([32, 32, 32, 4])
  })

  test('recoller les paquets reproduit exactement les octets d’origine (aucune perte, aucun doublon)', () => {
    const bytes = new Uint8Array(500).map((_, i) => (i * 7) % 256)
    const packets = packetizeBytes(bytes, 160)
    const total = packets.reduce((sum, p) => sum + p.length, 0)
    expect(total).toBe(bytes.length)

    const recombined = new Uint8Array(total)
    let offset = 0
    for (const packet of packets) {
      recombined.set(packet, offset)
      offset += packet.length
    }
    expect(recombined).toEqual(bytes)
  })

  test('une longueur exactement multiple de la taille de paquet ne crée pas de paquet vide final', () => {
    const bytes = new Uint8Array(160)
    const packets = packetizeBytes(bytes, 160)
    expect(packets).toHaveLength(1)
    expect(packets[0]).toHaveLength(160)
  })

  test('un flux plus court que la taille de paquet tient dans un seul paquet', () => {
    const bytes = new Uint8Array(50)
    const packets = packetizeBytes(bytes, 160)
    expect(packets).toHaveLength(1)
    expect(packets[0]).toHaveLength(50)
  })

  test('un flux vide ne produit aucun paquet', () => {
    expect(packetizeBytes(new Uint8Array(0))).toEqual([])
  })

  test('une taille de paquet nulle ou négative est refusée', () => {
    expect(() => packetizeBytes(new Uint8Array(10), 0)).toThrow()
    expect(() => packetizeBytes(new Uint8Array(10), -5)).toThrow()
  })
})
