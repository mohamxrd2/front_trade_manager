'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import dayjs from 'dayjs'

export default function AccountPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Impossible de charger vos informations.</p>
      </div>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Gérez votre profil utilisateur ici.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
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
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            {user.company_share !== undefined && (
              <div>
                <p className="text-muted-foreground">Part de l&apos;entreprise</p>
                <p className="font-medium">{user.company_share}%</p>
              </div>
            )}
            {user.created_at && (
              <div>
                <p className="text-muted-foreground">Membre depuis</p>
                <p className="font-medium">{dayjs(user.created_at).format('DD MMMM YYYY')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
