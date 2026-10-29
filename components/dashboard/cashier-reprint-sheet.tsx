'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { keys } from '@/lib/query-keys'
import { getOperation } from '@/lib/services/operations'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ReceiptActions } from '@/components/waelly/receipt-actions'

interface CashierReprintSheetProps {
  operationId: string | null
  onOpenChange: (open: boolean) => void
}

/** Chantier "Équipe" §6 — réimpression depuis "Ma caisse du jour", même ReceiptActions que le détail d'une transaction. */
function CashierReprintSheet({ operationId, onOpenChange }: CashierReprintSheetProps) {
  const { t } = useTranslation()
  const open = operationId !== null

  const { data: operation, isLoading } = useQuery({
    queryKey: keys.operations.detail(operationId ?? ''),
    queryFn: () => getOperation(operationId!),
    enabled: open,
  })

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DrawerContent className="px-5 pb-8 pt-2.5">
        <DrawerHeader className="mt-1.5">
          <DrawerTitle>{t('dashboard.cashier.reprintTitle')}</DrawerTitle>
        </DrawerHeader>
        <div className="mt-3.5">
          {isLoading || !operation ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-subtle" />
            </div>
          ) : (
            <ReceiptActions operation={operation} duplicate defaultOpen />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export { CashierReprintSheet }
export type { CashierReprintSheetProps }
