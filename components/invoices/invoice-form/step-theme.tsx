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

export function StepTheme() {
  const { t } = useTranslation()
  const { formData, updateFormData } = useInvoiceForm()

  const themes: ThemeOption[] = [
    {
      id: 'classic',
      name: t('invoices.themes.classic'),
      description: t('invoices.themes.classicDescription'),
      preview: (
        <div className="w-full aspect-[3/4] bg-white border rounded overflow-hidden p-3">
          <div className="h-8 bg-gray-800 rounded-sm mb-2" />
          <div className="space-y-1">
            <div className="h-2 bg-gray-200 rounded w-2/3" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="mt-3 border rounded p-2">
            <div className="h-2 bg-gray-300 rounded mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 bg-gray-100 rounded mb-1" />
            ))}
          </div>
          <div className="mt-auto pt-3 border-t mt-3">
            <div className="h-3 bg-gray-800 rounded w-1/3 ml-auto" />
          </div>
        </div>
      ),
    },
    {
      id: 'modern',
      name: t('invoices.themes.modern'),
      description: t('invoices.themes.modernDescription'),
      preview: (
        <div className="w-full aspect-[3/4] bg-gradient-to-br from-green-50 to-white border rounded overflow-hidden p-3">
          <div className="flex justify-between items-start mb-3">
            <div className="h-8 w-8 bg-green-500 rounded-lg" />
            <div className="text-right">
              <div className="h-2 bg-green-500 rounded w-12 mb-1" />
              <div className="h-1.5 bg-gray-200 rounded w-16" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="mt-3 bg-white rounded-lg p-2 shadow-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between mb-1">
                <div className="h-1.5 bg-gray-100 rounded w-1/2" />
                <div className="h-1.5 bg-green-100 rounded w-1/4" />
              </div>
            ))}
          </div>
          <div className="mt-auto pt-3 mt-3">
            <div className="h-4 bg-green-500 rounded-lg w-1/2 ml-auto" />
          </div>
        </div>
      ),
    },
    {
      id: 'minimal',
      name: t('invoices.themes.minimal'),
      description: t('invoices.themes.minimalDescription'),
      preview: (
        <div className="w-full aspect-[3/4] bg-white border rounded overflow-hidden p-3">
          <div className="text-center mb-4">
            <div className="h-6 w-6 bg-gray-900 rounded-full mx-auto mb-2" />
            <div className="h-2 bg-gray-200 rounded w-1/3 mx-auto" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-1.5 bg-gray-100 rounded w-1/3" />
              <div className="h-1.5 bg-gray-300 rounded w-1/4" />
            </div>
            <div className="h-px bg-gray-100" />
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-1.5 bg-gray-100 rounded w-1/2" />
                <div className="h-1.5 bg-gray-200 rounded w-1/5" />
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 mt-4 border-t">
            <div className="flex justify-between">
              <div className="h-2 bg-gray-300 rounded w-1/4" />
              <div className="h-2 bg-gray-900 rounded w-1/4" />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {themes.map((theme) => {
              const isSelected = formData.theme === theme.id

              return (
                <div
                  key={theme.id}
                  className={cn(
                    'relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md',
                    isSelected
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                  onClick={() => updateFormData({ theme: theme.id })}
                >
                  {/* Checkmark */}
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Preview */}
                  <div className="mb-4">{theme.preview}</div>

                  {/* Info */}
                  <div className="text-center">
                    <h3 className="font-semibold">{theme.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{theme.description}</p>
                  </div>
                </div>
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

