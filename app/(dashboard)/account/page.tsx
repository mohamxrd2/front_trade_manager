'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import { ImageUploader } from '@/components/media/image-uploader'
import { initialsOf } from '@/components/media/media-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'

export default function AccountPage() {
  const { user, loading, checkAuth } = useAuth()
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
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
            {/* Sa propre photo de profil : chacun peut la changer. */}
            <ImageUploader
              kind="avatar"
              ownerId="me"
              value={user.profile_image}
              onChange={() => void checkAuth()}
              alt={fullName}
              shape="circle"
              previewClassName="size-20"
              fallback={<span className="text-lg font-semibold text-ink-2">{initialsOf(fullName)}</span>}
            />
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
