'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, X } from 'lucide-react'

import { useNotifications } from '@/hooks/useNotifications'
import { useSettings } from '@/contexts/SettingsContext'
import { keys } from '@/lib/query-keys'
import {
  getNotifications,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
  type Notification,
  type NotificationsResponse,
} from '@/lib/services/notifications'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatRelative as formatRelativeTime, formatDate } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

/**
 * Notifications — design/maquettes/ordinateur/Web-Notifications.dc.html
 * (≥ 768px) et design/maquettes/mobile/Notifications.dc.html (< 768px). Un
 * seul composant, deux rendus (md:hidden / hidden md:block) partageant les
 * mêmes hooks et mutations.
 *
 * Le compteur de non-lues reste porté par `useNotifications()` (déjà
 * partagé par la cloche de l'Accueil, le badge Paramètres et le menu
 * latéral) plutôt qu'un nouveau hook `useUnreadCount` — créer un second
 * hook aurait fragmenté la seule source de vérité que la consigne demande.
 * Cette page construit sa PROPRE liste paginée (useInfiniteQuery) et ses
 * propres mutations optimistes, et déclenche l'événement
 * `notification-updated` déjà écouté par ce hook pour que le compteur se
 * resynchronise immédiatement après une action.
 *
 * Écarts assumés (la colonne réelle `type` de la table notifications est
 * `info | success | warning | error`, pas `stock | invoice | team`) :
 * - La catégorie (icône, filtre, libellé d'action) est déduite de
 *   `action_url` (/products → stock, /invoices → facture, /collaborators →
 *   équipe), avec repli sur « stock » si rien ne correspond. Pour les
 *   factures, « payée » vs « en retard » est déduit de `type === 'success'`.
 *
 * « Me prévenir quand… » est branché sur /api/user/settings (quatre
 * colonnes booléennes `notify_*`, ajoutées pour cette fonctionnalité) et sur
 * les points de création réels : NotificationService::checkLowStock (stock),
 * InvoiceController::updateStatus (paid/overdue → notifyInvoicePaid /
 * notifyInvoiceOverdue), CollaboratorController::store (notifyTeamJoined).
 * Un interrupteur désactivé empêche donc vraiment la création côté serveur,
 * pas seulement l'affichage.
 */

type Kind = 'stock' | 'invoice' | 'team'
type PrefKey = 'notify_stock_low' | 'notify_invoice_paid' | 'notify_invoice_overdue' | 'notify_team_joined'
type FilterId = 'all' | 'unread' | Kind

const KIND_STYLE: Record<Kind, { glyph: string; bg: string; text: string }> = {
  stock: { glyph: '!', bg: 'bg-warning-bg', text: 'text-warning' },
  invoice: { glyph: 'F', bg: 'bg-brand-100', text: 'text-brand-600' },
  team: { glyph: '+', bg: 'bg-info-bg', text: 'text-info' },
}

function buildPrefDefs(t: ReturnType<typeof useTranslation>['t']): { key: PrefKey; label: string }[] {
  return [
    { key: 'notify_stock_low', label: t('notifications.prefStockLow') },
    { key: 'notify_invoice_paid', label: t('notifications.prefInvoicePaid') },
    { key: 'notify_invoice_overdue', label: t('notifications.prefInvoiceOverdue') },
    { key: 'notify_team_joined', label: t('notifications.prefTeamJoined') },
  ]
}

function inferKind(n: Notification): Kind {
  if (n.article_id || n.action_url?.startsWith('/products')) return 'stock'
  if (n.action_url?.startsWith('/invoices')) return 'invoice'
  if (n.action_url?.startsWith('/collaborators') || n.action_url?.startsWith('/team')) return 'team'
  return 'stock'
}

function prefKeyFor(kind: Kind, n: Notification): PrefKey {
  if (kind === 'stock') return 'notify_stock_low'
  if (kind === 'team') return 'notify_team_joined'
  return n.type === 'success' ? 'notify_invoice_paid' : 'notify_invoice_overdue'
}

function actionLabelFor(n: Notification, kind: Kind, t: ReturnType<typeof useTranslation>['t']): string | null {
  if (!n.action_url) return null
  if (kind === 'stock') return t('products.detail.restock')
  if (kind === 'team') return t('notifications.actionViewTeam')
  return n.type === 'success' ? t('transactions.detail.viewInvoice') : t('notifications.actionFollowUp')
}

/** Délégation complète à lib/i18n/format.ts : "à l'instant"/"il y a X min" via
 *  formatRelative (Intl.RelativeTimeFormat), "Hier, HH:mm" et date courte au-delà
 *  via formatDate — plus aucun calcul de date ni libellé français codé en dur ici. */
function formatNotificationDate(iso: string, language: AppLanguage, t: ReturnType<typeof useTranslation>['t']): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return formatRelativeTime(iso, language, now)
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return `${t('wallet.yesterday')}, ${formatDate(iso, language, 'HH:mm')}`
  }
  return formatDate(iso, language, 'D MMM')
}

type EnrichedNotification = Notification & { kind: Kind; prefKey: PrefKey; actionLabel: string | null }

const PAGE_SIZE = 20
const LIST_QUERY_KEY = keys.notifications.list()

function dispatchUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('notification-updated'))
}

export default function NotificationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { unreadCount } = useNotifications()
  const { settings, updateSettings } = useSettings()
  const { t, language } = useTranslation()
  const PREF_DEFS = React.useMemo(() => buildPrefDefs(t), [t])

  const urlFilter = searchParams.get('filter') as FilterId | null
  const filter: FilterId = (['all', 'unread', 'stock', 'invoice', 'team'] as FilterId[]).includes(urlFilter as FilterId)
    ? (urlFilter as FilterId)
    : 'all'
  const setFilter = (next: FilterId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'all') params.delete('filter')
    else params.set('filter', next)
    router.replace(`/notifications${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  const togglePref = (key: PrefKey) => {
    const current = settings?.[key] ?? true
    void updateSettings({ [key]: !current })
  }

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: ({ pageParam }) => getNotifications(pageParam, PAGE_SIZE, false),
    staleTime: 30 * 1000, // Notifications : 30 s
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.current_page < lastPage.data.pagination.last_page
        ? lastPage.data.pagination.current_page + 1
        : undefined,
  })

  const rawList = React.useMemo(() => (data?.pages ?? []).flatMap((p) => p.data.notifications), [data])

  const enriched: EnrichedNotification[] = React.useMemo(
    () =>
      rawList.map((n) => {
        const kind = inferKind(n)
        return { ...n, kind, prefKey: prefKeyFor(kind, n), actionLabel: actionLabelFor(n, kind, t) }
      }),
    [rawList, t]
  )

  // Les préférences « Me prévenir quand… » contrôlent uniquement la CRÉATION
  // côté serveur (voir NotificationService) : désactiver un type n'efface ni
  // ne masque l'historique déjà reçu, donc pas de filtrage local ici.
  const filteredList = React.useMemo(
    () =>
      enriched.filter((n) => {
        if (filter === 'all') return true
        if (filter === 'unread') return !n.read
        return n.kind === filter
      }),
    [enriched, filter]
  )
  const unreadVisibleCount = enriched.filter((n) => !n.read).length

  const patchList = React.useCallback(
    (fn: (notifications: Notification[]) => Notification[]) => {
      queryClient.setQueryData<InfiniteData<NotificationsResponse>>(LIST_QUERY_KEY, (old) => {
        if (!old) return old
        return { ...old, pages: old.pages.map((p) => ({ ...p, data: { ...p.data, notifications: fn(p.data.notifications) } })) }
      })
    },
    [queryClient]
  )

  const handleMarkAsRead = React.useCallback(
    async (id: string) => {
      const target = rawList.find((n) => n.id === id)
      if (!target || target.read) return
      patchList((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
      dispatchUpdated()
      try {
        await apiMarkAsRead(id)
      } catch (error) {
        patchList((list) => list.map((n) => (n.id === id ? { ...n, read: false } : n)))
        dispatchUpdated()
        toast.error(error instanceof Error ? error.message : t('notifications.errorUpdateFailed'))
      }
    },
    [patchList, rawList, t]
  )

  const handleMarkAllAsRead = async () => {
    const previouslyUnread = rawList.filter((n) => !n.read).map((n) => n.id)
    if (previouslyUnread.length === 0) return
    patchList((list) => list.map((n) => ({ ...n, read: true })))
    dispatchUpdated()
    try {
      await apiMarkAllAsRead()
    } catch (error) {
      patchList((list) => list.map((n) => (previouslyUnread.includes(n.id) ? { ...n, read: false } : n)))
      dispatchUpdated()
      toast.error(error instanceof Error ? error.message : t('notifications.errorUpdateFailed'))
    }
  }

  const handleDelete = (notification: Notification) => {
    patchList((list) => list.filter((n) => n.id !== notification.id))
    dispatchUpdated()
    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      try {
        await apiDeleteNotification(notification.id)
        dispatchUpdated()
      } catch (error) {
        patchList((list) => [notification, ...list])
        dispatchUpdated()
        toast.error(error instanceof Error ? error.message : t('notifications.errorDeleteFailed'))
      }
    }, 5000)

    toast(t('notifications.toastDeleted'), {
      duration: 5000,
      action: {
        label: t('transactions.deleteFlow.undo'),
        onClick: () => {
          undone = true
          clearTimeout(timer)
          patchList((list) => [notification, ...list])
          dispatchUpdated()
        },
      },
    })
  }

  const handleOpen = (notification: EnrichedNotification) => {
    void handleMarkAsRead(notification.id)
    if (notification.action_url) router.push(notification.action_url)
  }

  const unreadLabel = unreadCount > 0 ? t('notifications.unreadCountIcu', { count: unreadCount }) : t('notifications.allCaughtUp')

  const DESKTOP_FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: t('notifications.filterAll') },
    { id: 'unread', label: t('notifications.filterUnreadCount', { count: unreadVisibleCount }) },
    { id: 'stock', label: t('notifications.filterStock') },
    { id: 'invoice', label: t('notifications.filterInvoices') },
    { id: 'team', label: t('notifications.filterTeam') },
  ]
  const MOBILE_FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: t('notifications.filterAll') },
    { id: 'unread', label: t('notifications.filterUnread') },
  ]

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div className="hidden flex-col gap-5 md:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('notifications.title')}</h1>
            <span className="text-sm text-subtle" aria-live="polite">
              {unreadLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="glass flex h-12 items-center rounded-full px-4.5 text-sm font-bold text-brand-700 disabled:opacity-50"
          >
            {t('notifications.markAllAsRead')}
          </button>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <section className="flex flex-[3_1_520px] flex-col gap-3 rounded-panel bg-surface p-5 shadow-card">
            <div className="flex flex-wrap gap-2">
              {DESKTOP_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-10 rounded-full px-4 text-[13px] font-semibold ${
                    filter === f.id ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink-2'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[92px] animate-pulse rounded-[20px] bg-surface-soft" />
                ))}
              </div>
            ) : filteredList.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-subtle">{t('notifications.noNewNotifications')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {filteredList.map((n) => {
                  const style = KIND_STYLE[n.kind]
                  return (
                    <li
                      key={n.id}
                      className={`flex items-start gap-3.5 rounded-[20px] p-4 ${
                        n.read ? 'border border-line bg-surface' : 'border border-brand-200 bg-brand-50'
                      }`}
                    >
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${style.bg} ${style.text}`}>
                        {style.glyph}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-[15px] ${n.read ? 'font-semibold' : 'font-bold'} text-ink`}>{n.title}</span>
                          {!n.read ? <span aria-label={t('notifications.unreadDotAria')} className="size-2 shrink-0 rounded-full bg-danger-dot" /> : null}
                        </span>
                        <span className="text-sm leading-[1.45] text-ink-2">
                          {n.message}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-3">
                          <span className="text-xs text-subtle">{formatNotificationDate(n.created_at, language, t)}</span>
                          {n.actionLabel ? (
                            <Link
                              href={n.action_url!}
                              onClick={() => void handleMarkAsRead(n.id)}
                              className="py-1.5 text-[13px] font-bold text-brand-600 no-underline"
                            >
                              {n.actionLabel}
                            </Link>
                          ) : null}
                          {!n.read ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkAsRead(n.id)}
                              className="min-h-8 border-0 bg-transparent p-0 text-[13px] font-semibold text-ink-3"
                            >
                              {t('notifications.markAsReadAction')}
                            </button>
                          ) : null}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(n)}
                        aria-label={t('notifications.deleteNotificationAria')}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-subtle"
                      >
                        <X className="size-[18px]" strokeWidth={2} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {hasNextPage ? (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="self-center rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-bold text-ink"
              >
                {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : t('notifications.loadMore')}
              </button>
            ) : null}
          </section>

          <aside
            aria-label={t('notifications.preferencesAria')}
            className="glass-panel flex flex-[2_1_300px] flex-col gap-1.5 rounded-panel p-5.5"
          >
            <h2 className="mb-2 text-lg font-bold text-ink">{t('notifications.notifyWhenTitle')}</h2>
            {PREF_DEFS.map((p) => {
              const on = settings?.[p.key] ?? true
              return (
              <div key={p.key} className="flex items-center gap-3 border-b border-line py-2.5">
                <span id={`pref-${p.key}`} className="flex-1 text-sm font-semibold text-ink">
                  {p.label}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={`pref-${p.key}`}
                  onClick={() => togglePref(p.key)}
                  className="flex p-[3px]"
                  style={{
                    width: 50,
                    height: 30,
                    borderRadius: 15,
                    justifyContent: on ? 'flex-end' : 'flex-start',
                    background: on ? '#5B3FE6' : '#C9C9D6',
                  }}
                >
                  <span className="rounded-full bg-white" style={{ width: 24, height: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              )
            })}
            <Link href="/settings?tab=preferences" className="mt-2 py-2 text-[13px] font-bold text-brand-600 no-underline">
              {t('notifications.editLowStockThreshold')}
            </Link>
          </aside>
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t('notifications.backAria')}
              className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
            >
              <ChevronLeft className="size-[22px]" strokeWidth={2} />
            </button>
            <h1 className="flex-1 text-[22px] font-bold text-ink">{t('notifications.title')}</h1>
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              className="flex min-h-11 items-center border-0 bg-transparent text-sm font-bold text-brand-500 disabled:opacity-40"
            >
              {t('notifications.markAllReadShort')}
            </button>
          </div>
          <div className="flex gap-2">
            {MOBILE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-10 rounded-full px-4 text-[13px] font-semibold ${
                  filter === f.id ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-[100px] animate-pulse rounded-[18px] bg-surface-soft" />)
          ) : filteredList.length === 0 ? (
            <p className="px-5 py-15 text-center text-sm text-subtle">
              {filter === 'unread' ? t('notifications.noUnreadNotifications') : t('notifications.noNewNotifications')}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {filteredList.map((n) => (
                <MobileNotificationCard key={n.id} notification={n} onOpen={handleOpen} onDelete={handleDelete} />
              ))}
            </ul>
          )}

          {hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="self-center rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-bold text-ink"
            >
              {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : t('notifications.loadMore')}
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function MobileNotificationCard({
  notification: n,
  onOpen,
  onDelete,
}: {
  notification: EnrichedNotification
  onOpen: (n: EnrichedNotification) => void
  onDelete: (n: Notification) => void
}) {
  const { t, language } = useTranslation()
  const [dragX, setDragX] = React.useState(0)
  const startX = React.useRef<number | null>(null)
  const style = KIND_STYLE[n.kind]

  return (
    <li
      className={`flex items-start gap-3 overflow-hidden rounded-[18px] p-3.5 ${
        n.read ? 'border border-line bg-canvas' : 'border border-line-strong bg-surface'
      }`}
      style={{ transform: `translateX(${dragX}px)`, transition: dragX === 0 ? 'transform 0.2s ease-out' : 'none' }}
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX
      }}
      onTouchMove={(e) => {
        if (startX.current === null) return
        const dx = e.touches[0].clientX - startX.current
        if (dx < 0) setDragX(dx)
      }}
      onTouchEnd={() => {
        if (dragX < -80) onDelete(n)
        setDragX(0)
        startX.current = null
      }}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${style.bg} ${style.text}`}>
        {style.glyph}
      </span>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className="flex min-w-0 flex-1 flex-col gap-1 border-0 bg-transparent p-0 text-left text-ink"
      >
        <span className="flex items-center gap-2">
          <span className={`text-sm ${n.read ? 'font-semibold' : 'font-bold'}`}>{n.title}</span>
          {!n.read ? <span aria-label={t('notifications.unreadDotAria')} className="size-2 shrink-0 rounded-full bg-danger-dot" /> : null}
        </span>
        <span className="text-[13px] leading-[1.4] text-ink-2">
          {n.message}
        </span>
        <span className="text-xs text-subtle">{formatNotificationDate(n.created_at, language, t)}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(n)}
        aria-label={t('notifications.deleteNotificationAria')}
        className="flex size-11 shrink-0 items-center justify-center border-0 bg-transparent text-subtle"
        style={{ margin: '-10px -10px 0 0' }}
      >
        <X className="size-[18px]" strokeWidth={2} />
      </button>
    </li>
  )
}
