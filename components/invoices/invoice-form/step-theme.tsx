'use client'

import { Check, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useInvoiceForm } from './invoice-form-context'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import type { InvoiceTheme } from '@/lib/services/invoices'

interface ThemeOption {
  id: InvoiceTheme
  name: string
  description: string
  preview: React.ReactNode
}

/**
 * Miniatures d'aperçu des 4 thèmes de facture. Les couleurs (hex) reproduisent
 * fidèlement celles utilisées par le backend pour générer les PDF réels — ce
 * ne sont pas des placeholders génériques, donc ne pas les faire dériver du
 * thème vert de l'appli.
 */
export function StepTheme() {
  const { t } = useTranslation()
  const { formData, updateFormData } = useInvoiceForm()

  const themes: ThemeOption[] = [
    {
      id: 'classic',
      name: t('invoices.themes.classic'),
      description: t('invoices.themes.classicDescription'),
      // Blanc, bordure noire épaisse, serif, titre centré espacé, en-tête de
      // tableau gris clair, zone de signature — look papier / comptable.
      preview: (
        <div className="w-full aspect-[3/4] bg-white border-[3px] border-[#1a1a1a] overflow-hidden p-3 font-serif flex flex-col">
          <div className="text-center mb-3">
            <div className="text-[7px] font-bold tracking-[0.3em] text-[#1a1a1a]">FACTURE</div>
          </div>
          <div className="flex justify-between mb-2">
            <div className="h-1.5 bg-gray-300 w-1/3" />
            <div className="h-1.5 bg-gray-300 w-1/4" />
          </div>
          <div className="border border-[#1a1a1a]">
            <div className="bg-[#f0f0f0] h-2 border-b border-[#1a1a1a]" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 border-b border-gray-200 last:border-0" />
            ))}
          </div>
          <div className="mt-auto pt-3 flex justify-end">
            <div className="w-10 border-t border-[#1a1a1a] pt-1">
              <div className="h-1 w-8 bg-gray-300" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'modern',
      name: t('invoices.themes.modern'),
      description: t('invoices.themes.modernDescription'),
      // Bandeau plein bleu vif + liseré bleu clair, zébrage bleu très clair,
      // badge de statut arrondi, sans-serif — look startup / SaaS.
      preview: (
        <div className="w-full aspect-[3/4] bg-white border rounded-lg overflow-hidden flex flex-col">
          <div className="bg-[#1d4ed8] px-2.5 py-2 flex justify-between items-center border-b-4 border-[#93c5fd]">
            <div className="h-1.5 w-8 bg-white/90 rounded-sm" />
            <div className="text-[6px] font-bold text-white tracking-wider">FACTURE</div>
          </div>
          <div className="p-2.5 flex-1 flex flex-col">
            <div className="flex justify-end mb-2">
              <div className="px-1.5 py-0.5 rounded-full bg-[#dbeafe] text-[5px] text-[#1d4ed8] font-semibold">
                PAYÉE
              </div>
            </div>
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn('flex justify-between px-1 py-1 rounded', i % 2 === 0 && 'bg-[#eff6ff]')}
                >
                  <div className="h-1.5 bg-gray-200 rounded w-1/2" />
                  <div className="h-1.5 bg-gray-300 rounded w-1/5" />
                </div>
              ))}
            </div>
            <div className="mt-auto pt-2 flex justify-end">
              <div className="h-3 bg-[#1d4ed8] rounded w-1/3" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'minimal',
      name: t('invoices.themes.minimal'),
      description: t('invoices.themes.minimalDescription'),
      // Quasi tout blanc, aucune couleur vive, libellés gris clair, fines
      // séparations, typographie petite et espacée — look épuré scandinave.
      preview: (
        <div className="w-full aspect-[3/4] bg-[#fcfcfc] border border-[#e0e0e0] overflow-hidden p-3 flex flex-col">
          <div className="mb-5">
            <div className="text-[6px] tracking-[0.25em] text-[#8c8c8c]">FACTURE</div>
          </div>
          <div className="space-y-2.5 flex-1">
            <div className="flex justify-between">
              <div className="h-1 bg-[#e0e0e0] w-1/4" />
              <div className="h-1 bg-[#8c8c8c] w-1/5" />
            </div>
            <div className="h-px bg-[#e0e0e0]" />
            <div className="flex justify-between">
              <div className="h-1 bg-[#e0e0e0] w-1/3" />
              <div className="h-1 bg-[#8c8c8c] w-1/6" />
            </div>
            <div className="h-px bg-[#e0e0e0]" />
          </div>
          <div className="mt-auto pt-4 flex justify-between items-baseline">
            <div className="h-1 bg-[#e0e0e0] w-1/5" />
            <div className="h-2 bg-[#8c8c8c] w-1/4" />
          </div>
        </div>
      ),
    },
    {
      id: 'professional',
      name: t('invoices.themes.professional'),
      description: t('invoices.themes.professionalDescription'),
      // Bandeau sombre marine/anthracite + liseré doré, encarts sur fond gris
      // clair avec titre souligné doré, serif, zones de signature formelles.
      preview: (
        <div className="w-full aspect-[3/4] bg-white border overflow-hidden flex flex-col font-serif">
          <div className="bg-[#1c2431] px-2.5 py-2 border-b-2 border-[#c9a96e]">
            <div className="text-[6px] tracking-[0.2em] text-[#c9a96e] font-semibold">FACTURE</div>
            <div className="h-1 w-1/2 bg-white/70 mt-1" />
          </div>
          <div className="p-2.5 flex-1 flex flex-col">
            <div className="bg-[#f5f5f4] p-1.5 mb-2">
              <div className="h-0.5 w-1/3 bg-[#c9a96e] mb-1" />
              <div className="h-1.5 bg-gray-300 rounded w-2/3" />
            </div>
            <div className="space-y-1.5">
              {[1, 2].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-1.5 bg-gray-200 rounded w-1/2" />
                  <div className="h-1.5 bg-gray-300 rounded w-1/5" />
                </div>
              ))}
            </div>
            <div className="mt-auto pt-3 flex justify-between">
              <div className="w-9 border-t border-gray-400 pt-1">
                <div className="h-1 w-7 bg-gray-300" />
              </div>
              <div className="w-9 border-t border-gray-400 pt-1">
                <div className="h-1 w-7 bg-gray-300" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5" />
            {t('invoices.selectTheme')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {themes.map((theme) => {
              const isSelected = formData.theme === theme.id

              return (
                <button
                  key={theme.id}
                  type="button"
                  className={cn(
                    'relative text-left cursor-pointer rounded-xl border-2 p-3 sm:p-4 transition-all hover:shadow-md',
                    isSelected
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-lg'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                  onClick={() => updateFormData({ theme: theme.id })}
                  aria-pressed={isSelected}
                >
                  {/* Checkmark */}
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Preview */}
                  <div className="mb-3 sm:mb-4 rounded-lg overflow-hidden shadow-sm">{theme.preview}</div>

                  {/* Info */}
                  <div className="text-center">
                    <h3 className="font-semibold text-sm">{theme.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <p className="text-sm text-center text-muted-foreground">
        {t('invoices.themeInfo')}
      </p>
    </div>
  )
}
