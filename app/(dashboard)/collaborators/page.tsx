'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Phone, Plus, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { keys } from '@/lib/query-keys'
import {
  getCollaborators,
  createCollaborator,
  updateCollaborator,
  deleteCollaborator,
  type Collaborator,
} from '@/lib/services/collaborators'
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
 * - « Part » : le backend interdit explicitement sa modification après
 *   création (422 sur PUT si le champ est présent) — le champ est donc
 *   désactivé en mode édition, avec une note explicative.
 */

type RoleValue = 'Vendeur' | 'Associé' | 'Couturier' | 'Gestionnaire'
const ROLE_OPTIONS: RoleValue[] = ['Vendeur', 'Associé', 'Couturier', 'Gestionnaire']

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

function formatShare(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)} %`
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
const collaboratorBaseSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255),
  phone: z
    .string()
    .min(1, 'Le téléphone est requis')
    .refine(isValidPhone, 'Format attendu : +225 suivi de 10 chiffres'),
  role: z.enum(ROLE_OPTIONS as [RoleValue, ...RoleValue[]], { message: 'Le rôle est requis' }),
  // Toujours optionnel au niveau du type (le champ est désactivé en mode
  // édition, donc exclu de la soumission native) — la contrainte réelle
  // (requis, 0,01-99,99 %, ≤ part disponible) n'est appliquée qu'en mode
  // ajout, via superRefine ci-dessous.
  part: z.coerce.number().optional(),
})

function buildSchema(mode: 'add' | 'edit', maxPart: number) {
  return collaboratorBaseSchema.superRefine((data, ctx) => {
    if (mode !== 'add') return
    const cap = Math.max(0.01, Math.min(99.99, maxPart))
    if (data.part === undefined || Number.isNaN(data.part)) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: 'La part est requise' })
    } else if (data.part < 0.01) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: 'La part doit être supérieure à 0 %' })
    } else if (data.part > cap) {
      ctx.addIssue({ code: 'custom', path: ['part'], message: `La part ne peut pas dépasser ${formatShare(maxPart)}` })
    }
  })
}

// z.coerce.number() a un type d'ENTRÉE `unknown` (ce que l'utilisateur tape,
// avant coercition) différent de son type de SORTIE `number | undefined`
// (après coercition) — useForm prend les deux génériques séparément pour
// éviter un conflit de typage avec le resolver zod.
type FormInput = z.input<typeof collaboratorBaseSchema>
type FormOutput = z.output<typeof collaboratorBaseSchema>
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

function formatAmount(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F`
}

/** Champs partagés du formulaire — identiques panneau ordinateur / bottom sheet mobile. */
function CollaboratorFormFields({
  register,
  errors,
  mode,
  remaining,
  currentPart,
  photoPreview,
  onPickPhoto,
  idPrefix,
  compact = false,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register']
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors']
  mode: 'add' | 'edit'
  remaining: number
  currentPart: number
  photoPreview: string | null
  onPickPhoto: (file: File) => void
  idPrefix: string
  compact?: boolean
}) {
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
        Ajouter une photo
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
          Nom complet
        </label>
        <input
          id={`${idPrefix}-name`}
          placeholder="Ex. Moussa Diallo"
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
          Téléphone
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          placeholder={compact ? '+225 07 00 00 00 00' : '+225 …'}
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
            Rôle
          </label>
          <select
            id={`${idPrefix}-role`}
            className={`${fieldHeight} min-w-0 rounded-field border border-line-strong bg-surface px-2.5 ${fieldText} text-ink`}
            {...register('role')}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-part`} className="text-[13px] font-semibold text-ink">
            Part (%)
          </label>
          <input
            id={`${idPrefix}-part`}
            inputMode="numeric"
            disabled={mode === 'edit'}
            defaultValue={mode === 'edit' ? currentPart : undefined}
            aria-describedby={`${idPrefix}-part-help`}
            className={`${fieldHeight} min-w-0 rounded-field border border-line-strong px-3.5 ${fieldText} text-ink disabled:bg-surface-soft disabled:text-ink-3`}
            {...register('part')}
          />
        </div>
      </div>
      {mode === 'add' ? (
        errors.part ? (
          <p id={`${idPrefix}-part-help`} className="-mt-1 text-xs text-danger-strong">
            {errors.part.message}
          </p>
        ) : (
          <p id={`${idPrefix}-part-help`} className="-mt-1 text-xs text-subtle">
            Reste à répartir : {formatShare(Math.max(0, remaining))}
          </p>
        )
      ) : (
        <p id={`${idPrefix}-part-help`} className="-mt-1 text-xs text-subtle">
          La part ne peut pas être modifiée après la création.
        </p>
      )}
    </>
  )
}

export default function CollaboratorsPage() {
  const { user, checkAuth } = useAuth()
  const queryClient = useQueryClient()

  const { data: collaborators, isLoading } = useQuery({
    queryKey: keys.collaborators.all,
    queryFn: getCollaborators,
  })

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [roleOverrides, setRoleOverrides] = React.useState<Record<string, RoleValue>>({})
  const [highlightId, setHighlightId] = React.useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null)
  const [removing, setRemoving] = React.useState(false)

  const companyShare = user ? Number(user.company_share ?? 0) : 0
  const editingCollaborator = (collaborators ?? []).find((c) => c.id === editingId) ?? null
  const mode: 'add' | 'edit' = editingCollaborator ? 'edit' : 'add'
  const remainingForEdit = editingCollaborator ? companyShare + Number(editingCollaborator.part) : companyShare

  const schema = React.useMemo(() => buildSchema(mode, companyShare), [mode, companyShare])
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
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
        toast.success('Collaborateur ajouté')
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
        toast.error(error instanceof Error ? error.message : 'Échec de l’ajout du collaborateur')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Édition
    const id = editingCollaborator!.id
    queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) =>
      old.map((c) => (c.id === id ? { ...c, name: data.name, phone: data.phone } : c))
    )
    setRoleOverrides((prev) => ({ ...prev, [id]: data.role }))

    try {
      const updated = await updateCollaborator(id, { name: data.name, phone: data.phone })
      queryClient.setQueryData<Collaborator[]>(keys.collaborators.all, (old = []) =>
        old.map((c) => (c.id === id ? updated : c))
      )
      toast.success('Modifications enregistrées')
      resetToAddMode()
      setDrawerOpen(false)
    } catch (error) {
      queryClient.setQueryData(keys.collaborators.all, previous)
      toast.error(error instanceof Error ? error.message : 'Échec de la modification')
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
      toast.success('Collaborateur retiré')
      setRemoveTarget(null)
      void checkAuth()
      if (editingId === target.collaborator.id) resetToAddMode()
    } catch (error) {
      queryClient.setQueryData(keys.collaborators.all, previous)
      toast.error(error instanceof Error ? error.message : 'Échec du retrait')
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
      role: 'Gérant · propriétaire',
      phone: null,
      share: companyShare,
      amount: Number(user.wallet ?? 0),
      image: user.profile_image ?? null,
    }
    const collabMembers: Member[] = (collaborators ?? []).map((c) => ({
      id: c.id,
      isOwner: false,
      name: c.name,
      initials: getInitials(c.name),
      role: roleOverrides[c.id] ?? 'Vendeur',
      phone: c.phone,
      amount: Number(c.wallet ?? 0),
      share: Number(c.part),
      image: c.image ?? null,
      collaborator: c,
    }))
    return [owner, ...collabMembers]
  }, [user, collaborators, roleOverrides, companyShare])

  const shareAria = members.map((m) => `${m.name} ${formatShare(m.share)}`).join(', ')
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
        <span className={`font-bold ${compact ? 'text-base' : 'text-[17px]'}`}>Répartition des parts</span>
        <span className="text-[13px]" style={{ color: '#C8C8F0' }}>
          {members.length} membres
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
            {m.name.split(' ')[0]} · {formatShare(m.share)}
          </span>
        ))}
      </div>
    </section>
  )

  const formFieldsNode = (idPrefix: string, compact: boolean) => (
    <CollaboratorFormFields
      register={form.register}
      errors={form.formState.errors}
      mode={mode}
      remaining={companyShare - (Number(form.watch('part')) || 0)}
      currentPart={remainingForEdit}
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
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Collaborateurs</h1>
          <span className="text-sm text-subtle">L’équipe associée à {user?.first_name ? `${user.first_name} ${user.last_name}` : 'votre entreprise'}</span>
        </div>

        {isLoading ? (
          <div className="h-[140px] animate-pulse rounded-panel bg-surface-soft" />
        ) : (
          <ShareBar compact={false} />
        )}

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
                          <dt className="text-subtle">Téléphone</dt>
                          <dd className="m-0 font-semibold text-ink">{m.phone}</dd>
                        </>
                      ) : null}
                      <dt className="text-subtle">Part</dt>
                      <dd className="m-0 font-bold" style={{ color: '#3A20B8' }}>
                        {formatShare(m.share)}
                      </dd>
                      <dt className="text-subtle">Montant</dt>
                      <dd className="m-0 font-bold text-success">{formatAmount(m.amount)}</dd>
                    </dl>
                    {!m.isOwner ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="flex min-h-10 flex-1 items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(m)}
                          className="flex min-h-10 items-center justify-center rounded-full border border-danger-border bg-surface px-3.5 text-[13px] font-semibold text-danger-strong"
                        >
                          Retirer
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
          </div>

          <aside
            aria-label="Ajouter un collaborateur"
            className="glass-panel sticky flex flex-[2_1_320px] flex-col gap-3.5 rounded-panel p-5.5"
            style={{ top: 20 }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">
                {mode === 'edit' ? 'Modifier le collaborateur' : 'Ajouter un collaborateur'}
              </h2>
              {mode === 'edit' ? (
                <button type="button" onClick={resetToAddMode} className="text-sm font-semibold text-brand-600">
                  Annuler
                </button>
              ) : null}
            </div>
            {isEmpty ? (
              <p className="text-sm text-subtle">
                Ajoutez votre premier collaborateur pour partager le suivi de l’activité.
              </p>
            ) : null}
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              {formFieldsNode('collab-desktop', false)}
              <Button type="submit" variant="primary" className="h-[50px] w-full" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === 'edit' ? 'Enregistrer' : 'Ajouter à l’équipe'}
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
            aria-label="Retour aux paramètres"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink">Collaborateurs</h1>
          <button
            type="button"
            onClick={openAddDrawer}
            aria-label="Ajouter un collaborateur"
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
                      {formatShare(m.share)}
                    </span>
                    <span className="text-xs font-bold text-success">{formatAmount(m.amount)}</span>
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
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        aria-label={`Retirer ${m.name}`}
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
            <DrawerTitle>{mode === 'edit' ? 'Modifier le collaborateur' : 'Ajouter un collaborateur'}</DrawerTitle>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer"
              className="flex size-10 items-center justify-center rounded-full bg-canvas text-ink"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </DrawerHeader>
          {isEmpty ? (
            <p className="text-sm text-subtle">Ajoutez votre premier collaborateur pour partager le suivi de l’activité.</p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-3.5 flex flex-col gap-3">
            {formFieldsNode('collab-mobile', true)}
            <Button type="submit" variant="primary" className="h-[54px] w-full text-base" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === 'edit' ? 'Enregistrer' : 'Ajouter à l’équipe'}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* ============================= Confirmation de retrait ============================= */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {removeTarget?.name} de l’équipe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Sa part de {removeTarget ? formatShare(removeTarget.share) : ''} sera à redistribuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removing}>
              {removing ? <Loader2 className="size-4 animate-spin" /> : null}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
