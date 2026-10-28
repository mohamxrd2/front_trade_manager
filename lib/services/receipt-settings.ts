import api, { isApiError } from '@/lib/api'

export type ReceiptWidth = '58mm' | '80mm'

export interface ReceiptSettings {
  width: ReceiptWidth
  show_logo: boolean
  show_address: boolean
  show_phone: boolean
  show_tax_id: boolean
  footer_message: string | null
  show_qr: boolean
  show_waelly_mention: boolean
  auto_print: boolean
}

export type ReceiptSettingsUpdatePayload = Partial<ReceiptSettings>

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  width: '58mm',
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_tax_id: true,
  footer_message: null,
  show_qr: true,
  show_waelly_mention: true,
  auto_print: false,
}

function handleReceiptSettingsError(error: unknown): never {
  if (isApiError(error)) {
    if (error.status === 422 && error.errors && typeof error.errors === 'object') {
      throw new Error(Object.values(error.errors as Record<string, string[]>).flat().join(', '))
    }
    throw new Error(error.message || 'Erreur lors de la mise à jour des réglages du ticket')
  }
  throw new Error('Erreur lors de la mise à jour des réglages du ticket')
}

/** Toujours une ligne (créée côté serveur avec ses valeurs par défaut au premier appel) — jamais `null`. */
export async function getReceiptSettings(): Promise<ReceiptSettings> {
  try {
    const response = await api.get<ApiResponse<ReceiptSettings>>('/api/receipt-settings')
    return response.data.data
  } catch (error) {
    handleReceiptSettingsError(error)
  }
}

export async function updateReceiptSettings(payload: ReceiptSettingsUpdatePayload): Promise<ReceiptSettings> {
  try {
    const response = await api.put<ApiResponse<ReceiptSettings>>('/api/receipt-settings', payload)
    return response.data.data
  } catch (error) {
    handleReceiptSettingsError(error)
  }
}
