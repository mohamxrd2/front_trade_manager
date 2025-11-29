'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { 
  Bell, 
  Check, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle,
  ArrowRight,
  MoreVertical
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Types pour les notifications
 */
interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: string
  actionUrl?: string
}

/**
 * Page Notifications
 * 
 * Affiche la liste des notifications de l'utilisateur
 */
export default function NotificationsPage() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Simuler le chargement des notifications
  // TODO: Remplacer par un appel API réel
  useEffect(() => {
    // Simuler un délai de chargement
    const timer = setTimeout(() => {
      setNotifications([
        {
          id: '1',
          type: 'success',
          title: 'Transaction ajoutée',
          message: 'Une nouvelle vente a été enregistrée avec succès.',
          read: false,
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          actionUrl: '/wallet',
        },
        {
          id: '2',
          type: 'warning',
          title: 'Stock faible',
          message: 'Le produit "Ordinateur HP" est en stock faible (5 unités restantes).',
          read: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          actionUrl: '/products',
        },
        {
          id: '3',
          type: 'info',
          title: 'Nouveau collaborateur',
          message: 'Un nouveau collaborateur a été ajouté à votre équipe.',
          read: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          actionUrl: '/collaborators',
        },
      ])
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    )
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const getTypeConfig = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-green-100 dark:bg-green-950',
          iconColor: 'text-green-600 dark:text-green-400',
          borderColor: 'border-green-200 dark:border-green-800',
          badge: <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950">{t('common.success')}</Badge>,
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-orange-100 dark:bg-orange-950',
          iconColor: 'text-orange-600 dark:text-orange-400',
          borderColor: 'border-orange-200 dark:border-orange-800',
          badge: <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950">{t('notifications.warning')}</Badge>,
        }
      case 'error':
        return {
          icon: XCircle,
          iconBg: 'bg-red-100 dark:bg-red-950',
          iconColor: 'text-red-600 dark:text-red-400',
          borderColor: 'border-red-200 dark:border-red-800',
          badge: <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950">{t('common.error')}</Badge>,
        }
      default:
        return {
          icon: Info,
          iconBg: 'bg-blue-100 dark:bg-blue-950',
          iconColor: 'text-blue-600 dark:text-blue-400',
          borderColor: 'border-blue-200 dark:border-blue-800',
          badge: <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">{t('notifications.info')}</Badge>,
        }
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 lg:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">{t('nav.notifications')}</h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground ml-12">
            {unreadCount > 0
              ? t('notifications.unreadCount', { count: unreadCount, plural: unreadCount > 1 ? 's' : '' })
              : t('notifications.allRead')}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead} className="sm:ml-auto">
            <Check className="h-4 w-4 mr-2" />
            {t('notifications.markAllAsRead')}
          </Button>
        )}
      </div>

      {/* Liste des notifications */}
      {notifications.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-16 text-center">
            <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('notifications.noNotifications')}</h3>
            <p className="text-muted-foreground">{t('notifications.noNotificationsDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const typeConfig = getTypeConfig(notification.type)
            const Icon = typeConfig.icon

            return (
              <Card
                key={notification.id}
                className={cn(
                  'rounded-xl transition-all hover:shadow-lg border-2',
                  !notification.read 
                    ? 'border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10' 
                    : 'border-border bg-card',
                  typeConfig.borderColor
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icône de type */}
                    <div className={cn(
                      'p-3 rounded-xl flex-shrink-0',
                      typeConfig.iconBg
                    )}>
                      <Icon className={cn('h-5 w-5', typeConfig.iconColor)} />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3
                              className={cn(
                                'font-semibold text-base',
                                !notification.read 
                                  ? 'text-foreground' 
                                  : 'text-muted-foreground line-through'
                              )}
                            >
                              {notification.title}
                            </h3>
                            {typeConfig.badge}
                          </div>
                          <p
                            className={cn(
                              'text-sm leading-relaxed',
                              !notification.read
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {notification.message}
                          </p>
                        </div>

                        {/* Menu d'actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!notification.read && (
                              <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                                <Check className="h-4 w-4 mr-2" />
                                {t('notifications.markAsRead')}
                              </DropdownMenuItem>
                            )}
                            {notification.actionUrl && (
                              <DropdownMenuItem asChild>
                                <a href={notification.actionUrl} className="flex items-center">
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  {t('notifications.viewDetails')}
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => deleteNotification(notification.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Date et actions rapides */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                        {notification.actionUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 text-xs"
                          >
                            <a href={notification.actionUrl} className="flex items-center gap-1">
                              {t('notifications.view')}
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

