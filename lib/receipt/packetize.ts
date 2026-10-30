/**
 * Découpe un flux d'octets ESC/POS en paquets de taille raisonnable pour
 * l'écriture GATT Bluetooth — beaucoup d'imprimantes thermiques BLE bon
 * marché perdent des données si on écrit tout d'un coup (tampon d'écriture
 * limité). 160 octets par défaut : au milieu de la fourchette 100-180
 * couramment recommandée pour ce type d'imprimante.
 */
export function packetizeBytes(bytes: Uint8Array<ArrayBuffer>, chunkSize = 160): Uint8Array<ArrayBuffer>[] {
  if (chunkSize <= 0) throw new Error('chunkSize doit être strictement positif')
  if (bytes.length === 0) return []

  const packets: Uint8Array<ArrayBuffer>[] = []
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    // .slice() plutôt que .subarray() : un paquet autonome avec son propre
    // ArrayBuffer, jamais un SharedArrayBuffer potentiel — BluetoothRemoteGATTCharacteristic.writeValue()
    // exige un BufferSource adossé à un ArrayBuffer classique.
    packets.push(bytes.slice(offset, offset + chunkSize))
  }
  return packets
}

/**
 * Comme packetizeBytes, mais par BLOCS (commandes ESC/POS ou lignes
 * complètes, voir encodeReceiptEscPosBlocks) : un paquet regroupe autant
 * de blocs entiers que possible, sans jamais couper un bloc — une commande
 * coupée entre deux écritures Bluetooth peut être mal reçue et ses octets
 * imprimés comme du texte. Un bloc plus grand qu'un paquet (ne devrait pas
 * arriver : l'encodeur découpe les images en bandes) est découpé en dernier
 * recours.
 */
export function packetizeBlocks(blocks: Uint8Array[], chunkSize = 160): Uint8Array<ArrayBuffer>[] {
  if (chunkSize <= 0) throw new Error('chunkSize doit être strictement positif')
  const packets: Uint8Array<ArrayBuffer>[] = []
  let current: number[] = []

  const flush = () => {
    if (current.length > 0) packets.push(Uint8Array.from(current))
    current = []
  }

  for (const block of blocks) {
    if (block.length > chunkSize) {
      flush()
      packets.push(...packetizeBytes(new Uint8Array(block), chunkSize))
      continue
    }
    if (current.length + block.length > chunkSize) flush()
    for (const byte of block) current.push(byte)
  }
  flush()
  return packets
}

