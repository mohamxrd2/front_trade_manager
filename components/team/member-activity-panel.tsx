'use client'

import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDateTime, formatMoney } from '@/lib/i18n/format'
import { keys } from '@/lib/query-keys'
import { getTeamActivity, type TeamMember } from '@/lib/services/team'
import { describeActivity } from '@/lib/permissions/activity-labels'
import { useCurrency } from '@/lib/utils/currency'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface MemberActivityPanelProps {
  member: TeamMember | null
  onOpenChange: (open: boolean) => void
}

function MemberActivityPanel({ member, onOpenChange }: MemberActivityPanelProps) {
  const { t, language } = useTranslation()
  const isDesktop = useIsDesktop()
  const { currency } = useCurrency()
  const open = member !== null
  const close = () => onOpenChange(false)

  const { data, isLoading } = useQuery({
    queryKey: keys.team.activity(member?.id),
    queryFn: () => getTeamActivity({ member: member!.id }),
    enabled: open,
  })

  const body = (
    <div className="flex flex-col gap-2.5">
      {isLoading
        ? [1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-soft" />)
        : (data?.data ?? []).length === 0
          ? <p className="py-6 text-center text-sm text-subtle">{t('team.activityEmpty')}</p>
          : (data?.data ?? []).map((entry) => {
              // Phrase complète : ce que la personne a fait (« A suspendu
              // Koffi ») ou ce qu'on lui a fait (« Suspension par Awa »).
              const label = describeActivity(entry, member?.id ?? '', t, (value) => formatMoney(value, currency, language))
              return (
                <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-line-strong bg-surface px-3.5 py-3">
                  <span className="text-sm font-semibold leading-snug text-ink">{label}</span>
                  <span className="text-xs text-subtle">{formatDateTime(entry.created_at, language)}</span>
                </div>
              )
            })}
    </div>
  )

  // SheetContent a déjà son propre bouton de fermeture (coin haut-droit) —
  // ne pas en remettre un ici sur ordinateur (deux "X" sinon) ; DrawerContent
  // (mobile) n'en fournit aucun, on garde le nôtre.
  const header = (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-base font-bold text-ink">{member ? t('team.activityTitle', { name: member.name }) : ''}</span>
      {isDesktop ? null : (
        <button type="button" onClick={close} aria-label={t('common.close')} className="flex size-9 items-center justify-center rounded-full bg-canvas text-ink">
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && close()}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-[420px]">
          <SheetHeader className="border-b border-line pb-3.5">
            <SheetTitle className="sr-only">{member ? t('team.activityTitle', { name: member.name }) : ''}</SheetTitle>
            {header}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[80vh] px-5 pb-8 pt-2.5">
        <DrawerHeader className="mt-1.5 p-0">
          <DrawerTitle className="sr-only">{member ? t('team.activityTitle', { name: member.name }) : ''}</DrawerTitle>
          {header}
        </DrawerHeader>
        <div className="mt-4 overflow-y-auto">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}

export { MemberActivityPanel }
export type { MemberActivityPanelProps }
