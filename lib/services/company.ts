import api, { isApiError } from '@/lib/api'
import { isSilentError } from '@/lib/utils/error-handler'

export interface Company {
  id: string
  name: string
  email: string | null
  sector: string | null
  headquarters: string | null
  legal_status: string | null
  bank_account_number: string | null
  logo: string | null
  logo_url: string | null
  is_invoice_ready: boolean
}

export interface CompanyUpdatePayload {
  name?: string
  email?: string | null
  sector?: string | null
  headquarters?: string | null
  legal_status?: string | null
  bank_account_number?: string | null
}

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

// L'intercepteur axios (lib/api.ts) transforme TOUJOURS l'erreur rejetée en
// ApiError plat (`error.status`, `error.message`, `error.errors`) — jamais
// une AxiosError imbriquée sous `.response`. Lire `.response.status` ici
// échouait silencieusement sur TOUT 404/422 réel (toujours le message
// générique ci-dessous, y compris pour un 404 "pas encore d'entreprise"
// qui devrait être traité comme un état normal, pas une erreur).
function handleCompanyError(error: unknown): never {
  if (isSilentError(error)) {
    throw error
  }
  if (isApiError(error)) {
    if (error.status === 422 && error.errors && typeof error.errors === 'object') {
      throw new Error(Object.values(error.errors as Record<string, string[]>).flat().join(', '))
    }
    throw new Error(error.message || 'Erreur lors de la mise à jour de l’entreprise')
  }
  throw new Error('Erreur lors de la mise à jour de l’entreprise')
}

/**
 * Récupère l'entreprise associée au compte connecté, ou `null` si aucune
 * n'a encore été créée (404 — état normal avant l'étape 2 de l'onboarding,
 * pas une erreur).
 */
export async function getCompany(): Promise<Company | null> {
  try {
    const response = await api.get<ApiResponse<Company>>('/api/company')
    return response.data.data
  } catch (error) {
    if (!isSilentError(error) && isApiError(error) && error.status === 404) {
      return null
    }
    handleCompanyError(error)
  }
}

/**
 * Met à jour les champs texte de l'entreprise (sans logo — voir uploadCompanyLogo).
 */
export async function updateCompany(payload: CompanyUpdatePayload): Promise<Company> {
  try {
    const response = await api.put<ApiResponse<Company>>('/api/company', payload)
    return response.data.data
  } catch (error) {
    handleCompanyError(error)
  }
}

/**
 * Envoie le logo de l'entreprise (multipart). Endpoint POST dédié plutôt que
 * d'inclure le fichier dans le PUT /api/company : Laravel ne peuple pas
 * $request->file() sur une requête PUT multipart native.
 */
export async function uploadCompanyLogo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<Pick<Company, 'logo' | 'logo_url'>> {
  try {
    const formData = new FormData()
    formData.append('logo', file)
    const response = await api.post<ApiResponse<Pick<Company, 'logo' | 'logo_url'>>>('/api/company/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (event) => {
            if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
          }
        : undefined,
    })
    return response.data.data
  } catch (error) {
    handleCompanyError(error)
  }
}
