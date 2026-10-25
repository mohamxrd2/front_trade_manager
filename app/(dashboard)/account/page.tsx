'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'

export default function AccountPage() {
  const { user, loading } = useAuth()
  const { t, language } = useTranslation()
  // Part toujours recalculée (100 − somme des parts actives des
  // collaborateurs), jamais lue de l'ancienne colonne user.company_share
  // figée tant qu'aucun rechargement n'avait lieu — même source que
  // /collaborators (lib/hooks/useCollaboratorShares.ts).
  const { ownerShare } = useCollaboratorShares()

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.loading')}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.loadError')}</p>
      </div>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.personalInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profile_image ?? undefined} alt={fullName} />
              <AvatarFallback className="text-lg">
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('clients.email')}</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('account.companyShare')}</p>
              <p className="font-medium">{ownerShare.share}%</p>
            </div>
            {user.created_at && (
              <div>
                <p className="text-muted-foreground">{t('account.memberSince')}</p>
                <p className="font-medium">{formatDate(user.created_at, language, 'DD MMMM YYYY')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
