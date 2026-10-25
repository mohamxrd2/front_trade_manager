'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Phone, Plus, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { keys } from '@/lib/query-keys'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import {
  createCollaborator,
  updateCollaborator,
  deleteCollaborator,
  type Collaborator,
} from '@/lib/services/collaborators'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Button } from '@/components/waelly'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

/**
 * Collaborateurs — design/maquettes/ordinateur/Web-Collaborateurs.dc.html
 * (≥ 768px) et design/maquettes/mobile/Collaborateurs.dc.html (< 768px). Un
 * seul composant, deux rendus (md:hidden / hidden md:block) partageant les
 * mêmes hooks, mutations et schéma de formulaire (zod).
 *
 * Écarts assumés (aucune colonne réelle correspondante en base) :
 * - « Rôle » : la table `collaborators` n'a pas de colonne role (store(),
 *   update() et la migration ne l'exposent pas). Le select est fonctionnel
 *   et affiché sur chaque carte, mais la valeur n'est conservée que pour la
 *   session en cours (état local), pas persistée côté serveur.
 * - « Ajouter une photo » : `image` est une simple chaîne ≤ 255 caractères
 *   côté API (pas un upload de fichier). L'aperçu local fonctionne, mais
 *   n'est jamais envoyé au serveur.
 * - Carte du propriétaire : aucune colonne téléphone sur User, donc pas de
 *   ligne « Téléphone » ni de lien d'appel sur sa carte. « Modifier » et
 *   « Retirer » sont masqués pour cette carte (ce n'est pas un
 *   `Collaborator`, c'est le compte lui-même — rien à appeler côté API).
 * - « Part » : modifiable en édition comme à l'ajout. Le plafond affiché
 *   ("Reste disponible") et la validation (zod + superRefine) excluent la
 *   part ACTUELLE du collaborateur en cours de modification de la somme
 *   des autres — il peut donc reprendre sa propre part sans être bloqué
 *   par elle-même. Le 422 serveur (somme réelle des autres parts > 100,
 *   voir CollaboratorController::update()) reste le filet de sécurité
 *   final en cas de modification concurrente entre deux onglets/appareils.
 */

type RoleValue = 'Vendeur' | 'Associé' | 'Couturier' | 'Gestionnaire'
const ROLE_OPTIONS: RoleValue[] = ['Vendeur', 'Associé', 'Couturier', 'Gestionnaire'] // i18n:allow — identifiants internes (état local, jamais persistés ni affichés directement — voir roleLabels(t) pour le texte affiché)

const AVATAR_CYCLE = [
  { bg: 'bg-brand-100', text: 'text-brand-600' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]
const SHARE_COLORS = ['bg-share-1', 'bg-share-2', 'bg-share-3', 'bg-share-4', 'bg-share-5']

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function roleLabels(t: ReturnType<typeof useTranslation>['t']): Record<RoleValue, string> {
  return {
    Vendeur: t('collaborators.roleSeller'),
    Associé: t('collaborators.rolePartner'),
    Couturier: t('collaborators.roleTailor'),
    Gestionnaire: t('collaborators.roleManager'),
  }
}

function isValidPhone(value: string): boolean {
  return /^\+225\d{10}$/.test(value.replace(/\s/g, ''))
}

/** Préremplit le champ Téléphone du formulaire d'ajout — seul indicatif pris en charge (+225 avec 10 chiffres). */
const PHONE_PREFIX = '+225 '

// Forme de base stable (même input/output zod quel que soit le mode) : le
// `superRefine` conditionnel ne change ni la forme ni le type, seulement les
// erreurs levées — nécessaire pour que useForm<FormInput, any, FormOutput>
// garde un type cohérent entre les deux modes ajout/édition.
function buildBaseSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z.object({
    name: z.string().min(1, t('collaborators.validation.nameRequired')).max(255),
    phone: z
      .string()
      .min(1, t('collaborators.validation.phoneRequired'))
      .refine(isValidPhone, t('collaborators.validationPhoneFormat')),
    role: z.enum(ROLE_OPTIONS as [RoleValue, ...RoleValue[]], { message: t('collaborators.validationRoleRequired') }),
    // Toujours optionnel au niveau du type : la contrainte réelle (requis,
    // 0,01-99,99 %, ≤ part disponible) est appliquée en ajout ET en édition
    // via superRefine ci-dessous — `maxPart` est déjà "la part disponible
    // POUR CE formulaire" (exclut les autres collaborateurs, pas celui-ci).
    part: z.coerce.number().optional(),
  })
}

function buildSchema(t: ReturnType<typeof useTranslation>['t'], language: AppLanguage, maxPart: number) {
  return buildBaseSchema(t).superRefine((data, ctx) => {
    const cap = Math.max(0.01, Math.min(99.99, maxPart))
    if (data.part === undefined || Number.isNaN(data.part)) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: t('collaborators.validationPartRequired') })
    } else if (data.part < 0.01) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: t('collaborators.validationPartMin') })
    } else if (data.part > cap) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: t('collaborators.validationPartExceeds', { share: formatShare(maxPart, language) }) })
    }
  })
}

// z.coerce.number() a un type d'ENTRÉE `unknown` (ce que l'utilisateur tape,
// avant coercition) différent de son type de SORTIE `number | undefined`
// (après coercition) — useForm prend les deux génériques séparément pour
// éviter un conflit de typage avec le resolver zod.
type FormInput = z.input<ReturnType<typeof buildBaseSchema>>
type FormOutput = z.output<ReturnType<typeof buildBaseSchema>>
type FormValues = FormInput

interface Member {
  id: string
  isOwner: boolean
  name: string
  initials: string
  role: string
  phone: string | null
  share: number
  /** Montant réel correspondant à `share` : part du revenu net de l'entreprise (ventes − dépenses) × part %, déjà calculé côté API (Collaborator.wallet / User.wallet). */
  amount: number
  image: string | null
  collaborator?: Collaborator
}

function formatAmount(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 0 })} F`
}

/** Champs partagés du formulaire — identiques panneau ordinateur / bottom sheet mobile. */
function CollaboratorFormFields({
  register,
  errors,
  remaining,
  photoPreview,
  onPickPhoto,
  idPrefix,
  compact = false,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register']
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors']
  remaining: number
  photoPreview: string | null
  onPickPhoto: (file: File) => void
  idPrefix: string
  compact?: boolean
}) {
  const { t, language } = useTranslation()
  const labels = roleLabels(t)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const fieldHeight = compact ? 'h-[50px]' : 'h-12'
  const fieldText = compact ? 'text-base' : 'text-sm'

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`flex items-center self-start rounded-[30px] border border-dashed border-[#B9B9C8] bg-surface dark:border-[#45455F] text-[13px] font-semibold text-ink-2 ${
          compact ? 'gap-2.5 py-1.5 pl-1.5 pr-3.5' : 'gap-3 py-2 pl-2 pr-3.5'
        }`}
      >
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local, jamais envoyé au serveur (image côté API = chaîne ≤255 caractères, pas un upload).
          <img
            src={photoPreview}
            alt=""
            className="rounded-full object-cover"
            style={compact ? { width: 40, height: 40 } : { width: 44, height: 44 }}
          />
        ) : (
          <span
            className="flex items-center justify-center rounded-full bg-brand-100 text-brand-600"
            style={compact ? { width: 40, height: 40, fontSize: 18 } : { width: 44, height: 44, fontSize: 20 }}
          >
            +
          </span>
        )}
        {t('collaborators.addPhoto')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickPhoto(file)
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-name`} className="text-[13px] font-semibold text-ink">
          {t('collaborators.fullNameLabel')}
        </label>
        <input
          id={`${idPrefix}-name`}
          placeholder={t('collaborators.fullNamePlaceholder')}
          aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
          className={`${fieldHeight} rounded-field border border-line-strong px-3.5 ${fieldText} text-ink`}
          {...register('name')}
        />
        {errors.name ? (
          <p id={`${idPrefix}-name-error`} className="text-xs text-danger-strong">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-phone`} className="text-[13px] font-semibold text-ink">
          {t('collaborators.phone')}
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          placeholder={compact ? t('collaborators.phonePlaceholderCompact') : t('collaborators.phonePlaceholderWide')}
          aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined}
          className={`${fieldHeight} rounded-field border border-line-strong px-3.5 ${fieldText} text-ink`}
          {...register('phone')}
        />
        {errors.phone ? (
          <p id={`${idPrefix}-phone-error`} className="text-xs text-danger-strong">
            {errors.phone.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-role`} className="text-[13px] font-semibold text-ink">
            {t('collaborators.roleLabel')}
          </label>
          <select
            id={`${idPrefix}-role`}
            className={`${fieldHeight} min-w-0 rounded-field border border-line-strong bg-surface px-2.5 ${fieldText} text-ink`}
            {...register('role')}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {labels[opt]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-part`} className="text-[13px] font-semibold text-ink">
            {t('collaborators.shareLabel')}
          </label>
          <input
            id={`${idPrefix}-part`}
            inputMode="numeric"
            aria-describedby={`${idPrefix}-part-help`}
            aria-invalid={!!errors.part}
            className={`${fieldHeight} min-w-0 rounded-field border px-3.5 ${fieldText} text-ink ${
              errors.part ? 'border-danger-border' : 'border-line-strong'
            }`}
            {...register('part')}
          />
        </div>
      </div>
      {errors.part ? (
        <p id={`${idPrefix}-part-help`} className="-mt-1 text-xs font-semibold text-danger-strong">
          {errors.part.message}
        </p>
      ) : (
        <p id={`${idPrefix}-part-help`} className="-mt-1 text-xs text-subtle">
          {t('collaborators.remainingAvailable', { share: formatShare(Math.max(0, remaining), language) })}
        </p>
      )}
    </>
  )
}

export default function CollaboratorsPage() {
  const { user, checkAuth } = useAuth()
  const { t, language } = useTranslation()
  const labels = roleLabels(t)
  const queryClient = useQueryClient()
  // Part et montant du gérant (et de chaque collaborateur) viennent
  // désormais UNIQUEMENT de ce hook : la part est toujours recalculée
  // (100 − somme des parts actives), jamais lue d'une colonne figée
  // (l'ancien user.company_share ne se resynchronisait pas tout seul après
  // un ajout/modif/retrait — c'était le bug). Le montant vient du même
  // total "ventes − dépenses depuis le début" que le solde du portefeuille,
  // déjà invalidé après chaque vente/dépense.
  const { base, isNegativeBase, isLoading, collaborators, ownerShare, remainingShare, getShare } =
    useCollaboratorShares()

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [roleOverrides, setRoleOverrides] = React.useState<Record<string, RoleValue>>({})
  const [highlightId, setHighlightId] = React.useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null)
  const [removing, setRemoving] = React.useState(false)

  const editingCollaborator = (collaborators ?? []).find((c) => c.id === editingId) ?? null
  const mode: 'add' | 'edit' = editingCollaborator ? 'edit' : 'add'
  // Part disponible POUR CE formulaire : en édition, `remainingShare`
  // exclut déjà la part actuelle du collaborateur qu'on modifie (elle est
  // comptée dans "la somme de tous les collaborateurs") — on la rajoute
  // pour obtenir "100 − somme des AUTRES", qui est le vrai plafond de cette
  // modification (le collaborateur peut reprendre sa propre part).
  const remainingForEdit = editingCollaborator
    ? remainingShare + Number(editingCollaborator.part)
    : remainingShare

  const schema = React.useMemo(() => buildSchema(t, language, remainingForEdit), [t, language, remainingForEdit])
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    // onChange : le message d'erreur sous "Part (%)" et la désactivation du
    // bouton Enregistrer doivent réagir immédiatement pendant la saisie, pas
    // seulement après une première tentative d'envoi refusée.
    mode: 'onChange',
    defaultValues: { name: '', phone: PHONE_PREFIX, role: 'Vendeur', part: 10 },
  })

  const resetToAddMode = React.useCallback(() => {
    setEditingId(null)
    setPhotoPreview(null)
    form.reset({ name: '', phone: PHONE_PREFIX, role: 'Vendeur', part: 10 })
  }, [form])

  const startEdit = (member: Member) => {
    if (!member.collaborator) return
    setEditingId(member.collaborator.id)
    setPhotoPreview(member.collaborator.image ?? null)
    form.reset({
      name: member.collaborator.name,
      phone: member.collaborator.phone,
      role: roleOverrides[member.collaborator.id] ?? 'Vendeur',
      part: Number(member.collaborator.part),
    })
    setDrawerOpen(true)
  }

  const handlePickPhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    const tempId = `temp-${Date.now()}`
    const previous = queryClient.getQueryData<Collaborator[]>(keys.collaborators.all)

    if (mode === 'add') {
      // superRefine garantit un `part` défini et valide (0,01-99,99 %) à ce stade.
      const part = Number(data.part)
      const optimistic: Collaborator = {
        id: tempId,
        user_id: user?.id ?? '',
        name: data.name,
        phone: data.phone,
        part,
        image: null,
        wallet: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) => [optimistic, ...old])
      setRoleOverrides((prev) => ({ ...prev, [tempId]: data.role }))

      try {
        const created = await createCollaborator({ name: data.name, phone: data.phone, part, image: null })
        queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) =>
          old.map((c) => (c.id === tempId ? created : c))
        )
        setRoleOverrides((prev) => {
          const next = { ...prev }
          delete next[tempId]
          next[created.id] = data.role
          return next
        })
        // Confirme en arrière-plan que le cache optimiste ci-dessus
        // correspond bien à l'état serveur (parts/montants recalculés par
        // useCollaboratorShares dès que ce cache change).
        void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
        toast.success(t('collaborators.toastAddedShort'))
        setHighlightId(created.id)
        setTimeout(() => setHighlightId(null), 2000)
        resetToAddMode()
        setDrawerOpen(false)
        void checkAuth()
      } catch (error) {
        queryClient.setQueryData(keys.collaborators.all, previous)
        setRoleOverrides((prev) => {
          const next = { ...prev }
          delete next[tempId]
          return next
        })
        toast.error(error instanceof Error ? error.message : t('collaborators.errorAddFailed'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Édition — superRefine garantit un `part` défini et valide à ce stade.
    const id = editingCollaborator!.id
    const part = Number(data.part)
    queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) =>
      old.map((c) => (c.id === id ? { ...c, name: data.name, phone: data.phone, part } : c))
    )
    setRoleOverrides((prev) => ({ ...prev, [id]: data.role }))

    try {
      const updated = await updateCollaborator(id, { name: data.name, phone: data.phone, part })
      queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) =>
        old.map((c) => (c.id === id ? updated : c))
      )
      void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
      toast.success(t('collaborators.toastUpdatedShort'))
      resetToAddMode()
      setDrawerOpen(false)
    } catch (error) {
      queryClient.setQueryData(keys.collaborators.all, previous)
      toast.error(error instanceof Error ? error.message : t('collaborators.errorUpdateFailed'))
    } finally {
      setSubmitting(false)
    }
  })

  const confirmRemove = async () => {
    const target = removeTarget
    if (!target?.collaborator) return
    setRemoving(true)
    const previous = queryClient.getQueryData<Collaborator[]>(keys.collaborators.all)
    queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) => old.filter((c) => c.id !== target.collaborator!.id))

    try {
      await deleteCollaborator(target.collaborator.id)
      void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
      toast.success(t('collaborators.toastRemoved'))
      setRemoveTarget(null)
      void checkAuth()
      if (editingId === target.collaborator.id) resetToAddMode()
    } catch (error) {
      queryClient.setQueryData(keys.collaborators.all, previous)
      toast.error(error instanceof Error ? error.message : t('collaborators.errorRemoveFailed'))
    } finally {
      setRemoving(false)
    }
  }

  const members: Member[] = React.useMemo(() => {
    if (!user) return []
    const owner: Member = {
      id: 'owner',
      isOwner: true,
      name: `${user.first_name} ${user.last_name}`.trim(),
      initials: getInitials(`${user.first_name} ${user.last_name}`),
      role: t('collaborators.ownerRole'),
      phone: null,
      share: ownerShare.share,
      amount: ownerShare.amount,
      image: user.profile_image ?? null,
    }
    const collabMembers: Member[] = (collaborators ?? []).map((c) => ({
      id: c.id,
      isOwner: false,
      name: c.name,
      initials: getInitials(c.name),
      role: labels[roleOverrides[c.id] ?? 'Vendeur'],
      phone: c.phone,
      amount: getShare(c.id)?.amount ?? 0,
      share: Number(c.part),
      image: c.image ?? null,
      collaborator: c,
    }))
    return [owner, ...collabMembers]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, collaborators, roleOverrides, ownerShare, getShare, t])

  const shareAria = members.map((m) => `${m.name} ${formatShare(m.share, language)}`).join(', ')
  const isEmpty = !isLoading && members.length <= 1

  const openAddDrawer = () => {
    resetToAddMode()
    setDrawerOpen(true)
  }

  const ShareBar = ({ compact }: { compact: boolean }) => (
    <section
      className="flex flex-col text-white shadow-[0_14px_30px_rgba(16,16,120,0.24)]"
      style={{
        borderRadius: compact ? 24 : 26,
        padding: compact ? 18 : 22,
        gap: compact ? 12 : 14,
        background: `radial-gradient(${compact ? '120% 120%' : '120% 140%'} at 100% 100%, #3A3AF0 0%, #1717A0 40%, #0A0A4A 85%)`,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-bold ${compact ? 'text-base' : 'text-[17px]'}`}>{t('collaborators.shareDistribution')}</span>
        <span className="text-[13px]" style={{ color: '#C8C8F0' }}>
          {t('collaborators.teamSize', { count: members.length })}
        </span>
      </div>
      {isLoading ? (
        <div className="h-3.5 animate-pulse rounded-full bg-white/15" />
      ) : (
        <div
          role="img"
          aria-label={shareAria}
          className="flex overflow-hidden"
          style={{ height: compact ? 12 : 14, borderRadius: compact ? 6 : 7, gap: 3 }}
        >
          {members.map((m, i) => (
            <span
              key={m.id}
              className={`block h-full ${SHARE_COLORS[i % 5]}`}
              style={{ flex: `${Math.max(m.share, 0.01)} 1 0` }}
            />
          ))}
        </div>
      )}
      <div className={`flex flex-wrap ${compact ? 'gap-2 text-xs' : 'gap-4 text-[13px]'}`} style={{ color: '#DCDCF7' }}>
        {members.map((m, i) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span
              className={`rounded-full ${SHARE_COLORS[i % 5]}`}
              style={{ width: compact ? 8 : 10, height: compact ? 8 : 10 }}
            />
            {m.name.split(' ')[0]} · {formatShare(m.share, language)}
          </span>
        ))}
      </div>
    </section>
  )

  // "Reste disponible" est statique : "100 − somme des parts des AUTRES
  // collaborateurs" — pas réduit par ce qui est en train d'être tapé (le
  // message d'erreur sous le champ s'en charge déjà si la saisie dépasse).
  const formFieldsNode = (idPrefix: string, compact: boolean) => (
    <CollaboratorFormFields
      register={form.register}
      errors={form.formState.errors}
      remaining={remainingForEdit}
      photoPreview={photoPreview}
      onPickPhoto={handlePickPhoto}
      idPrefix={idPrefix}
      compact={compact}
    />
  )

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div className="hidden flex-col gap-5 md:flex">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('collaborators.title')}</h1>
          <span className="text-sm text-subtle">
            {t('collaborators.teamOf', { name: user?.first_name ? `${user.first_name} ${user.last_name}` : t('collaborators.yourCompanyFallback') })}
          </span>
        </div>

        {isLoading ? (
          <div className="h-[140px] animate-pulse rounded-panel bg-surface-soft" />
        ) : (
          <ShareBar compact={false} />
        )}
        {!isLoading && isNegativeBase ? (
          <p className="text-sm font-semibold" style={{ color: '#A3213A' }}>
            {t('collaborators.negativeResultPeriod', { amount: formatAmount(base, language) })}
          </p>
        ) : null}

        <div className="flex flex-wrap items-start gap-5">
          <div
            className="grid flex-[3_1_480px] gap-3.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}
          >
            {isLoading
              ? [1, 2, 3, 4].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-[24px] bg-surface-soft" />)
              : members.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-3.5 rounded-[24px] bg-surface p-5 shadow-card transition-shadow ${
                      highlightId === m.id ? 'ring-2 ring-brand-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="" className="size-[52px] shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          className={`flex size-[52px] shrink-0 items-center justify-center rounded-full text-base font-extrabold ${AVATAR_CYCLE[members.indexOf(m) % 5].bg} ${AVATAR_CYCLE[members.indexOf(m) % 5].text}`}
                        >
                          {m.initials}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-base font-bold text-ink">{m.name}</span>
                        <span className="text-[13px] text-subtle">{m.role}</span>
                      </span>
                    </div>
                    <dl
                      className="m-0 grid gap-x-3 gap-y-1.5 text-[13px]"
                      style={{ gridTemplateColumns: 'auto 1fr' }}
                    >
                      {m.phone ? (
                        <>
                          <dt className="text-subtle">{t('collaborators.phone')}</dt>
                          <dd className="m-0 font-semibold text-ink">{m.phone}</dd>
                        </>
                      ) : null}
                      <dt className="text-subtle">{t('collaborators.share')}</dt>
                      <dd className="m-0 font-bold" style={{ color: '#3A20B8' }}>
                        {formatShare(m.share, language)}
                      </dd>
                      <dt className="text-subtle">{t('transactions.amount')}</dt>
                      <dd
                        className={`m-0 font-bold ${m.amount < 0 ? '' : 'text-success'}`}
                        style={m.amount < 0 ? { color: '#A3213A' } : undefined}
                      >
                        {formatAmount(m.amount, language)}
                      </dd>
                    </dl>
                    {!m.isOwner ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="flex min-h-10 flex-1 items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink"
                        >
                          {t('products.detail.modify')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(m)}
                          className="flex min-h-10 items-center justify-center rounded-full border border-danger-border bg-surface px-3.5 text-[13px] font-semibold text-danger-strong"
                        >
                          {t('collaborators.remove')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
          </div>

          <aside
            aria-label={t('collaborators.addCollaborator')}
            className="glass-panel sticky flex flex-[2_1_320px] flex-col gap-3.5 rounded-panel p-5.5"
            style={{ top: 20 }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">
                {mode === 'edit' ? t('collaborators.editCollaborator') : t('collaborators.addCollaborator')}
              </h2>
              {mode === 'edit' ? (
                <button type="button" onClick={resetToAddMode} className="text-sm font-semibold text-brand-600">
                  {t('common.cancel')}
                </button>
              ) : null}
            </div>
            {isEmpty ? (
              <p className="text-sm text-subtle">
                {t('collaborators.addFirstCollaboratorHint')}
              </p>
            ) : null}
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              {formFieldsNode('collab-desktop', false)}
              <Button type="submit" variant="primary" className="h-[50px] w-full" disabled={submitting || !!form.formState.errors.part}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === 'edit' ? t('products.save') : t('collaborators.addToTeam')}
              </Button>
            </form>
          </aside>
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label={t('collaborators.backToSettingsAria')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink">{t('collaborators.title')}</h1>
          <button
            type="button"
            onClick={openAddDrawer}
            aria-label={t('collaborators.addCollaborator')}
            className="flex size-12 items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(75,47,214,0.35)]"
            style={{ background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)' }}
          >
            <Plus className="size-[22px]" strokeWidth={2.2} />
          </button>
        </div>

        {isLoading ? (
          <div className="h-[120px] animate-pulse rounded-[24px] bg-surface-soft" />
        ) : (
          <ShareBar compact />
        )}
        {!isLoading && isNegativeBase ? (
          <p className="text-sm font-semibold" style={{ color: '#A3213A' }}>
            {t('collaborators.negativeResultPeriod', { amount: formatAmount(base, language) })}
          </p>
        ) : null}

        {isLoading
          ? [1, 2, 3].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-[20px] bg-surface-soft" />)
          : members.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 transition-shadow ${
                  highlightId === m.id ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${AVATAR_CYCLE[members.indexOf(m) % 5].bg} ${AVATAR_CYCLE[members.indexOf(m) % 5].text}`}
                    >
                      {m.initials}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold text-ink">{m.name}</span>
                    <span className="text-[13px] text-subtle">{m.role}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-brand-100 px-2.5 py-1.5 text-[13px] font-extrabold text-brand-700">
                      {formatShare(m.share, language)}
                    </span>
                    <span
                      className={`text-xs font-bold ${m.amount < 0 ? '' : 'text-success'}`}
                      style={m.amount < 0 ? { color: '#A3213A' } : undefined}
                    >
                      {formatAmount(m.amount, language)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {m.phone ? (
                    <a
                      href={`tel:${m.phone.replace(/\s/g, '')}`}
                      className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full bg-canvas text-[13px] font-semibold text-ink"
                    >
                      <Phone className="size-4" strokeWidth={2} />
                      {m.phone}
                    </a>
                  ) : null}
                  {!m.isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className={`flex min-h-[42px] items-center justify-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink ${m.phone ? '' : 'flex-1'}`}
                      >
                        {t('products.detail.modify')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        aria-label={t('collaborators.removeNamedAria', { name: m.name })}
                        className="flex size-[42px] shrink-0 items-center justify-center rounded-full border border-danger-border bg-surface text-danger-strong"
                      >
                        <X className="size-4" strokeWidth={2} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
      </div>

      {/* ============================= Bottom sheet (mobile) ============================= */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) resetToAddMode()
        }}
      >
        <DrawerContent className="px-5 pb-8 pt-2.5">
          <DrawerHeader className="mt-1.5">
            <DrawerTitle>{mode === 'edit' ? t('collaborators.editCollaborator') : t('collaborators.addCollaborator')}</DrawerTitle>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('common.close')}
              className="flex size-10 items-center justify-center rounded-full bg-canvas text-ink"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </DrawerHeader>
          {isEmpty ? (
            <p className="text-sm text-subtle">{t('collaborators.addFirstCollaboratorHint')}</p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-3.5 flex flex-col gap-3">
            {formFieldsNode('collab-mobile', true)}
            <Button type="submit" variant="primary" className="h-[54px] w-full text-base" disabled={submitting || !!form.formState.errors.part}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === 'edit' ? t('products.save') : t('collaborators.addToTeam')}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ============================= Confirmation de retrait ============================= */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('collaborators.removeConfirmTitle', { name: removeTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('collaborators.removeConfirmDescription', { share: removeTarget ? formatShare(removeTarget.share, language) : '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removing}>
              {removing ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('collaborators.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
