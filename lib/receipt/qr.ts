import QRCode from 'qrcode'

/** `null` en cas d'échec (jamais bloquant — le ticket reste utilisable sans QR). */
export async function generateReceiptQrDataUrl(payload: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(payload, { margin: 1, width: 192 })
  } catch {
    return null
  }
}
