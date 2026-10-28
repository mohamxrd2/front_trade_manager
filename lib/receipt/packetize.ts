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
