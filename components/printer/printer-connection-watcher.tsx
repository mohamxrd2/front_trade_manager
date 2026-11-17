'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'

/**
 * Monté une fois dans le tableau de bord : reconnexion silencieuse à la
 * dernière imprimante au chargement, et toast « Imprimante déconnectée » dès
 * qu'elle est perdue (éteinte, hors de portée) — sur n'importe quelle page.
 * Une déconnexion demandée (« Déconnecter ») n'affiche rien.
 */
export function PrinterConnectionWatcher() {
  const { t } = useTranslation()
  const init = useBluetoothPrinterStore((s) => s.init)
  const reconnect = useBluetoothPrinterStore((s) => s.reconnect)
  const lostCount = useBluetoothPrinterStore((s) => s.lostCount)
  const seenLostCount = React.useRef(lostCount)

  React.useEffect(() => {
    void init()
  }, [init])

  React.useEffect(() => {
    if (lostCount <= seenLostCount.current) return
    seenLostCount.current = lostCount
    const canRetrySilently = typeof navigator !== 'undefined' && 'bluetooth' in navigator && 'getDevices' in navigator.bluetooth
    toast.error(t('wallet.printerStatus.lost'), {
      id: 'printer-lost',
      description: canRetrySilently ? t('wallet.printerStatus.lostDescription') : undefined,
      action: {
        label: t('wallet.printerStatus.reconnect'),
        onClick: () => {
          reconnect().catch(() => toast.error(t('wallet.printerStatus.connectFailed')))
        },
      },
    })
  }, [lostCount, reconnect, t])

  return null
}
