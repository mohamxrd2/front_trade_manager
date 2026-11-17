'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { getCompany } from '@/lib/services/company'
import { getReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/lib/services/receipt-settings'
import { keys } from '@/lib/query-keys'
import { buildReceipt } from '@/lib/receipt/build-receipt'
import { receiptCompanyInfo, receiptDisplaySettings, receiptLabels, sampleReceiptOperation } from '@/lib/receipt/receipt-context'
import { encodeReceiptEscPosBlocks } from '@/lib/receipt/escpos-encoder'
import { printerDotsFor } from '@/lib/receipt/escpos/raster'
import { loadLogoImageData } from '@/lib/receipt/load-logo-canvas'
import { readCutPaper, readPrintLogo, readPrintQr, readPrinterCharset } from '@/lib/receipt/printer-preferences'
import { useBluetoothPrinterStore, type PrintResult } from '@/lib/stores/bluetooth-printer'

/**
 * Ticket d'exemple (celui de l'aperçu des Paramètres) envoyé à l'imprimante
 * Bluetooth connectée, avec les réglages du ticket de l'entreprise et ceux
 * de cet appareil (table de caractères, logo, QR, coupe) — comme une vraie vente.
 */
export function usePrintTestTicket(): () => Promise<PrintResult> {
  const { t, language } = useTranslation()
  const { settings: userSettings } = useSettings()
  const { user } = useAuth()
  const print = useBluetoothPrinterStore((s) => s.print)

  const { data: company } = useQuery({ queryKey: keys.settings.company(), queryFn: getCompany, staleTime: 30 * 60 * 1000 })
  const { data: receiptSettings } = useQuery({ queryKey: keys.settings.receipt(), queryFn: getReceiptSettings, staleTime: 10 * 60 * 1000 })

  return React.useCallback(async () => {
    const settings = receiptDisplaySettings(receiptSettings ?? DEFAULT_RECEIPT_SETTINGS)
    const companyInfo = receiptCompanyInfo(company, `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim())
    const model = buildReceipt(sampleReceiptOperation(t), companyInfo, settings, {
      language,
      currency: userSettings?.currency,
      labels: receiptLabels(t),
    })
    try {
      const printLogo = readPrintLogo() && settings.showLogo && !!companyInfo.logoUrl
      const logoImage =
        printLogo && companyInfo.logoUrl ? await loadLogoImageData(companyInfo.logoUrl, Math.round(printerDotsFor(model.width) * 0.6), 160) : null
      const blocks = encodeReceiptEscPosBlocks(model, {
        charset: readPrinterCharset(),
        cutPaper: readCutPaper(),
        printLogo,
        logoImage,
        printQr: readPrintQr() && settings.showQr,
        companyNameFallback: companyInfo.name,
      })
      return await print(blocks)
    } catch {
      return { ok: false, errorCode: 'write-failed' }
    }
  }, [t, language, userSettings?.currency, user?.first_name, user?.last_name, company, receiptSettings, print])
}
