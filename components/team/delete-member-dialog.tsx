'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { isDeleteConfirmationValid } from '@/lib/team/confirm-delete'
import type { TeamMember } from '@/lib/services/team'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/waelly'

interface DeleteMemberDialogProps {
  member: TeamMember | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Suppression DÉFINITIVE du compte d'un membre — confirmation forte : il faut
 * retaper son nom (le bouton reste désactivé sinon). À distinguer de
 * « Retirer », qui ne fait que désactiver l'accès.
 */
function DeleteMemberDialog({ member, pending, onOpenChange, onConfirm }: DeleteMemberDialogProps) {
  const { t } = useTranslation()
  const [typed, setTyped] = React.useState('')
  const name = member?.name ?? ''
  const valid = isDeleteConfirmationValid(typed, name)

  React.useEffect(() => {
    if (!member) setTyped('')
  }, [member])

  return (
    <AlertDialog open={!!member} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('team.deleteConfirmTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('team.deleteConfirmDescription', { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="team-delete-confirm" className="text-[13px] font-semibold text-ink">
            {t('team.deleteConfirmTypeLabel', { name })}
          </label>
          <input
            id="team-delete-confirm"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
          <Button type="button" variant="danger" disabled={!valid || pending} onClick={onConfirm}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('team.actions.deletePermanently')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteMemberDialog }
