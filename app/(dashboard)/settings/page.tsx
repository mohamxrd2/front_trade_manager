'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/components/theme-provider'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { keys } from '@/lib/query-keys'
import { useNotifications } from '@/hooks/useNotifications'
import { updateUserProfile, updateUserPassword } from '@/lib/auth'
import { getCompany, updateCompany, uploadCompanyLogo, type Company } from '@/lib/services/company'
import { getCollaborators } from '@/lib/services/collaborators'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * Paramètres — design/maquettes/ordinateur/Web-Parametres.dc.html (≥ 1024px)
 * et design/maquettes/mobile/Parametres.dc.html (< 768px). Un seul
 * composant, deux rendus (hidden md:block / md:hidden) partageant le même
 * état et les mêmes mutations — voir § « COMMUN » de la consigne.
 *
 * Écarts assumés (aucun endpoint réel ne permet de les réaliser) :
 * - « Changer la photo » (profil) : aucun endpoint d'upload pour l'avatar
 *   utilisateur (PUT /api/user/profile attend `profile_image` comme simple
 *   chaîne ≤ 255 caractères, pas un fichier). L'aperçu local fonctionne,
 *   mais n'est pas persisté côté serveur.
 * - « Dissocier » / « Connecter » (comptes Google/Facebook) : le backend n'a
 *   ni endpoint de dissociation, ni réelle association d'un second
 *   fournisseur à un compte existant (colonne `provider` unique sur
 *   l'utilisateur, pas une table de liaisons). Les boutons affichent le
 *   statut réel mais n'exécutent qu'un message d'information.
 * - « Supprimer mon compte » : aucun endpoint de suppression de compte
 *   n'existe côté backend. La boîte de confirmation (avec saisie du nom de
 *   l'entreprise) est fonctionnelle, mais la confirmation finale affiche un
 *   message d'indisponibilité plutôt que d'appeler une route inexistante.
 */

type TabId = 'profil' | 'entreprise' | 'preferences' | 'securite'

const TABS: { id: TabId; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'entreprise', label: 'Entreprise' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'securite', label: 'Sécurité' },
]

const CURRENCY_OPTIONS = [
  { value: 'FCFA', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
]
const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]
// Listes alignées sur l'onboarding (app/(onboarding)/onboarding/entreprise)
// pour qu'un même champ ait la même liste de choix partout dans l'app.
const SECTOR_OPTIONS = ['Mode & textile', 'Alimentation', 'Cosmétique', 'Électronique', 'Restauration', 'Services', 'Autre']
const LEGAL_STATUS_OPTIONS = ['Entreprise individuelle', 'SARL', 'SA', 'Auto-entrepreneur']
const THEME_OPTIONS: { id: 'light' | 'dark' | 'system'; label: string }[] = [
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
  { id: 'system', label: 'Auto' },
]

// Cycle de 5 couleurs d'avatar — design/DESIGN.md § 2.
const AVATAR_CYCLE = [
  { bg: 'bg-brand-100', text: 'text-brand-600' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
}

interface CompanyDraft {
  name: string
  sector: string
  headquarters: string
  legal_status: string
  bank_account_number: string
}

function companyToDraft(company: Company | null | undefined): CompanyDraft {
  return {
    name: company?.name ?? '',
    sector: company?.sector ?? '',
    headquarters: company?.headquarters ?? '',
    legal_status: company?.legal_status ?? '',
    bank_account_number: company?.bank_account_number ?? '',
  }
}

/** Champs partagés « Mon profil » — identiques carte ordinateur / bottom sheet mobile. */
function ProfileFields({
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  avatarLabel,
  photoPreview,
  onPickPhoto,
  idPrefix,
}: {
  fullName: string
  onFullNameChange: (v: string) => void
  email: string
  onEmailChange: (v: string) => void
  avatarLabel: string
  photoPreview: string | null
  onPickPhoto: (file: File) => void
  idPrefix: string
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex items-center gap-4">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL), jamais persisté côté serveur.
          <img
            src={photoPreview}
            alt=""
            className="size-18 rounded-full object-cover"
            style={{ width: 72, height: 72 }}
          />
        ) : (
          <span
            className="flex size-18 items-center justify-center rounded-full text-[22px] font-extrabold text-white"
            style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #6A4CF0, #2B2BD9)' }}
          >
            {avatarLabel}
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          className="h-[42px] px-4 text-[13px]"
          onClick={() => fileRef.current?.click()}
        >
          Changer la photo
        </Button>
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
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-name`} className="text-[13px] font-semibold text-ink">
            Nom complet
          </label>
          <input
            id={`${idPrefix}-name`}
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-email`} className="text-[13px] font-semibold text-ink">
            E-mail
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
      </div>
    </div>
  )
}

/** Champs partagés « Profil de l'entreprise » — identiques onglet ordinateur / bottom sheet mobile. */
function CompanyFields({
  draft,
  onChange,
  logoPreview,
  onPickLogo,
  idPrefix,
}: {
  draft: CompanyDraft
  onChange: (next: CompanyDraft) => void
  logoPreview: string | null
  onPickLogo: (file: File) => void
  idPrefix: string
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const sectorOptions = draft.sector && !SECTOR_OPTIONS.includes(draft.sector) ? [draft.sector, ...SECTOR_OPTIONS] : SECTOR_OPTIONS
  const legalOptions =
    draft.legal_status && !LEGAL_STATUS_OPTIONS.includes(draft.legal_status)
      ? [draft.legal_status, ...LEGAL_STATUS_OPTIONS]
      : LEGAL_STATUS_OPTIONS

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex items-center gap-4">
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local avant envoi à POST /api/company/logo.
          <img
            src={logoPreview}
            alt=""
            className="object-cover"
            style={{ width: 72, height: 72, borderRadius: 20 }}
          />
        ) : (
          <span
            className="flex items-center justify-center text-[22px] font-extrabold text-white"
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)',
            }}
          >
            {getInitials(draft.name || 'AC')}
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          className="h-[42px] px-4 text-[13px]"
          onClick={() => fileRef.current?.click()}
        >
          Changer le logo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickLogo(file)
          }}
        />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-name`} className="text-[13px] font-semibold text-ink">
            Nom de l’entreprise
          </label>
          <input
            id={`${idPrefix}-name`}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-sector`} className="text-[13px] font-semibold text-ink">
            Secteur
          </label>
          <select
            id={`${idPrefix}-sector`}
            value={draft.sector}
            onChange={(e) => onChange({ ...draft, sector: e.target.value })}
            className="h-12 rounded-field border border-line-strong bg-surface px-3 text-[15px] text-ink"
          >
            {sectorOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-hq`} className="text-[13px] font-semibold text-ink">
            Siège
          </label>
          <input
            id={`${idPrefix}-hq`}
            value={draft.headquarters}
            onChange={(e) => onChange({ ...draft, headquarters: e.target.value })}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-legal`} className="text-[13px] font-semibold text-ink">
            Statut légal
          </label>
          <select
            id={`${idPrefix}-legal`}
            value={draft.legal_status}
            onChange={(e) => onChange({ ...draft, legal_status: e.target.value })}
            className="h-12 rounded-field border border-line-strong bg-surface px-3 text-[15px] text-ink"
          >
            {legalOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-iban`} className="text-[13px] font-semibold text-ink">
            IBAN / compte bancaire
          </label>
          <input
            id={`${idPrefix}-iban`}
            value={draft.bank_account_number}
            onChange={(e) => onChange({ ...draft, bank_account_number: e.target.value })}
            placeholder="CI00 0000 0000 0000 0000"
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
      </div>
    </div>
  )
}

/** Formulaire de changement de mot de passe — entièrement autonome (son propre bouton « Mettre à jour »), réutilisé carte ordinateur / bottom sheet mobile. */
function PasswordForm({ idPrefix, onSuccess }: { idPrefix: string; onSuccess?: () => void }) {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNext, setShowNext] = React.useState(false)
  const [errors, setErrors] = React.useState<{ next?: string; confirm?: string }>({})
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async () => {
    const nextErrors: { next?: string; confirm?: string } = {}
    if (next.length < 8) nextErrors.next = '8 caractères minimum'
    if (confirm !== next) nextErrors.confirm = 'Les mots de passe ne correspondent pas'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await updateUserPassword({
        current_password: current,
        new_password: next,
        new_password_confirmation: confirm,
      })
      toast.success('Mot de passe mis à jour')
      setCurrent('')
      setNext('')
      setConfirm('')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec de la mise à jour du mot de passe')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-current`} className="text-[13px] font-semibold text-ink">
          Mot de passe actuel
        </label>
        <div className="relative">
          <input
            id={`${idPrefix}-current`}
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-12 w-full rounded-field border border-line-strong px-3.5 pr-11 text-[15px] text-ink"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
          >
            {showCurrent ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-next`} className="text-[13px] font-semibold text-ink">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <input
              id={`${idPrefix}-next`}
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={`h-12 w-full rounded-field border px-3.5 pr-11 text-[15px] text-ink ${errors.next ? 'border-danger-border' : 'border-line-strong'}`}
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              aria-label={showNext ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
            >
              {showNext ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
          {errors.next ? <p className="text-xs text-danger-strong">{errors.next}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-confirm`} className="text-[13px] font-semibold text-ink">
            Confirmer
          </label>
          <input
            id={`${idPrefix}-confirm`}
            type={showNext ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`h-12 rounded-field border px-3.5 text-[15px] text-ink ${errors.confirm ? 'border-danger-border' : 'border-line-strong'}`}
          />
          {errors.confirm ? <p className="text-xs text-danger-strong">{errors.confirm}</p> : null}
        </div>
      </div>
      <Button
        type="button"
        variant="black"
        className="h-[46px] self-start px-5"
        onClick={handleSubmit}
        disabled={submitting || !current || !next || !confirm}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Mettre à jour
      </Button>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth } = useAuth()
  const { settings, updateSettings } = useSettings()
  const { unreadCount } = useNotifications()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mountedTheme, setMountedTheme] = React.useState(false)
  React.useEffect(() => setMountedTheme(true), [])

  const urlTab = searchParams.get('tab') as TabId | null
  const activeTab: TabId = urlTab && TABS.some((t) => t.id === urlTab) ? urlTab : 'profil'
  const setActiveTab = (id: TabId) => router.replace(`/settings?tab=${id}`, { scroll: false })

  const { data: company } = useQuery({
    queryKey: keys.settings.company(),
    queryFn: getCompany,
    staleTime: 30 * 60 * 1000, // Paramètres/entreprise : 30 min
  })
  const { data: collaborators } = useQuery({
    queryKey: keys.collaborators.all,
    queryFn: getCollaborators,
    staleTime: 5 * 60 * 1000, // Collaborateurs : 5 min — même clé que /collaborators
  })

  // ---- Brouillon Profil ----
  const [fullName, setFullName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [photoPicked, setPhotoPicked] = React.useState(false)
  React.useEffect(() => {
    if (user) {
      setFullName(`${user.first_name} ${user.last_name}`.trim())
      setEmail(user.email)
    }
  }, [user])
  const sourceFullName = user ? `${user.first_name} ${user.last_name}`.trim() : ''
  const profileDirty = fullName !== sourceFullName || email !== (user?.email ?? '') || photoPicked

  // ---- Brouillon Entreprise ----
  const [companyDraft, setCompanyDraft] = React.useState<CompanyDraft>(companyToDraft(undefined))
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (company) setCompanyDraft(companyToDraft(company))
  }, [company])
  // Affiche le logo déjà enregistré côté serveur tant qu'aucun nouveau
  // fichier n'a été sélectionné localement (sinon on écraserait l'aperçu en
  // cours avec l'ancienne valeur serveur à chaque refetch).
  React.useEffect(() => {
    if (company?.logo_url && !logoFile) setLogoPreview(company.logo_url)
  }, [company, logoFile])
  const sourceCompanyDraft = companyToDraft(company)
  const companyDirty = JSON.stringify(companyDraft) !== JSON.stringify(sourceCompanyDraft) || logoFile !== null

  // ---- Brouillon Préférences ----
  const [currency, setCurrency] = React.useState('FCFA')
  const [threshold, setThreshold] = React.useState(5)
  const [language, setLanguageDraft] = React.useState<'fr' | 'en'>('fr')
  React.useEffect(() => {
    if (settings) {
      setCurrency(settings.currency)
      setThreshold(settings.low_stock_threshold)
      setLanguageDraft((settings.language as 'fr' | 'en') ?? 'fr')
    }
  }, [settings])
  const prefsDirty =
    !!settings &&
    (currency !== settings.currency || threshold !== settings.low_stock_threshold || language !== settings.language)

  const [saving, setSaving] = React.useState(false)
  const [mobileEditProfileOpen, setMobileEditProfileOpen] = React.useState(false)
  const [mobileCompanyOpen, setMobileCompanyOpen] = React.useState(false)
  const [mobilePasswordOpen, setMobilePasswordOpen] = React.useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('')

  const isDirty = activeTab === 'profil' ? profileDirty : activeTab === 'entreprise' ? companyDirty : activeTab === 'preferences' ? prefsDirty : false

  const handlePickPhoto = (file: File) => {
    setPhotoPicked(true)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handlePickLogo = (file: File) => {
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeTab === 'profil') {
        const { first_name, last_name } = splitFullName(fullName)
        await updateUserProfile({ first_name, last_name, email })
        await checkAuth()
        toast.success('Modifications enregistrées')
      } else if (activeTab === 'entreprise') {
        if (logoFile) {
          await uploadCompanyLogo(logoFile)
          setLogoFile(null)
        }
        await updateCompany(companyDraft)
        await queryClient.invalidateQueries({ queryKey: keys.settings.company() })
        toast.success('Modifications enregistrées')
      } else if (activeTab === 'preferences') {
        await updateSettings({ currency, low_stock_threshold: threshold, language })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec de l’enregistrement')
      if (activeTab === 'entreprise') setCompanyDraft(sourceCompanyDraft)
      if (activeTab === 'profil') {
        setFullName(sourceFullName)
        setEmail(user?.email ?? '')
      }
    } finally {
      setSaving(false)
    }
  }

  const avatarInitials = getInitials(sourceFullName || user?.username || '?')
  const providerConnected = (provider: 'google' | 'facebook') => user?.provider === provider
  const notConfigured = () => toast.info('Cette action n’est pas encore disponible.')

  // Le propriétaire compte comme membre à part entière sur /collaborators
  // (sa part == user.company_share y est affichée au même titre que les
  // collaborateurs) : ce sous-titre doit refléter le même total.
  const allMembers = user
    ? [{ id: 'owner', name: `${user.first_name} ${user.last_name}`.trim() }, ...(collaborators ?? [])]
    : (collaborators ?? [])
  const collaboratorAvatars = allMembers.slice(0, 3)
  const collaboratorCount = allMembers.length

  const handleConfirmLogout = async () => {
    setLogoutDialogOpen(false)
    await logout()
  }

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div className="hidden flex-col gap-5 md:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Paramètres</h1>
            <span className="text-sm text-subtle">Profil, entreprise, préférences et sécurité</span>
          </div>
          {activeTab !== 'securite' ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex h-12 items-center rounded-full px-5.5 text-sm font-bold text-white disabled:opacity-50"
              style={{
                background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)',
                boxShadow: '0 8px 20px rgba(75,47,214,0.35)',
              }}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Enregistrer
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Sections"
          className="glass self-start flex flex-wrap gap-1 rounded-panel p-1"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            const idx = TABS.findIndex((t) => t.id === activeTab)
            const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length
            setActiveTab(TABS[next].id)
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] rounded-full px-5 text-sm ${
                tab.id === activeTab ? 'bg-active font-bold text-white' : 'bg-transparent font-semibold text-ink-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profil' ? (
          <div className="flex flex-wrap items-start gap-5">
            <section className="flex flex-[3_1_460px] flex-col gap-4.5 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">Mon profil</h2>
              <ProfileFields
                fullName={fullName}
                onFullNameChange={setFullName}
                email={email}
                onEmailChange={setEmail}
                avatarLabel={avatarInitials}
                photoPreview={photoPreview}
                onPickPhoto={handlePickPhoto}
                idPrefix="profil-desktop"
              />
            </section>
            <section className="flex flex-[2_1_300px] flex-col gap-3 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">Comptes connectés</h2>
              <div className="flex items-center gap-3 border-b border-divider py-2.5">
                <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-ink-3 font-bold text-ink">
                  G
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">Google</span>
                  <span className={`text-xs ${providerConnected('google') ? 'text-success-strong' : 'text-subtle'}`}>
                    {providerConnected('google') ? 'Connecté' : 'Non connecté'}
                  </span>
                </span>
                {providerConnected('google') ? (
                  <Button type="button" variant="secondary" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    Dissocier
                  </Button>
                ) : (
                  <Button type="button" variant="black" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    Connecter
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-ink-3 font-bold text-ink">
                  f
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">Facebook</span>
                  <span className={`text-xs ${providerConnected('facebook') ? 'text-success-strong' : 'text-subtle'}`}>
                    {providerConnected('facebook') ? 'Connecté' : 'Non connecté'}
                  </span>
                </span>
                {providerConnected('facebook') ? (
                  <Button type="button" variant="secondary" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    Dissocier
                  </Button>
                ) : (
                  <Button type="button" variant="black" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    Connecter
                  </Button>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'entreprise' ? (
          <section className="flex flex-col gap-4.5 rounded-panel bg-surface p-6 shadow-card">
            <h2 className="text-lg font-bold text-ink">Profil de l’entreprise</h2>
            <CompanyFields
              draft={companyDraft}
              onChange={setCompanyDraft}
              logoPreview={logoPreview}
              onPickLogo={handlePickLogo}
              idPrefix="entreprise-desktop"
            />
          </section>
        ) : null}

        {activeTab === 'preferences' ? (
          <section className="flex flex-col rounded-panel bg-surface px-6 py-0.5 shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-divider py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <label htmlFor="pref-devise" className="text-[15px] font-bold text-ink">
                  Devise
                </label>
                <span className="text-[13px] text-subtle">Utilisée pour vos prix, ventes et factures</span>
              </span>
              <select
                id="pref-devise"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-[46px] min-w-[200px] rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-divider py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[15px] font-bold text-ink">Seuil de stock faible</span>
                <span className="text-[13px] text-subtle">Vous êtes alerté quand un article passe sous ce nombre</span>
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setThreshold((v) => Math.max(0, v - 1))}
                  aria-label="Diminuer le seuil"
                  className="flex size-[42px] items-center justify-center rounded-full border border-line-strong bg-surface text-lg font-bold text-ink"
                >
                  −
                </button>
                <span aria-live="polite" className="w-10 text-center text-lg font-extrabold text-ink">
                  {threshold}
                </span>
                <button
                  type="button"
                  onClick={() => setThreshold((v) => v + 1)}
                  aria-label="Augmenter le seuil"
                  className="flex size-[42px] items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white"
                >
                  +
                </button>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-divider py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <label htmlFor="pref-langue" className="text-[15px] font-bold text-ink">
                  Langue
                </label>
                <span className="text-[13px] text-subtle">Langue de l’application</span>
              </span>
              <select
                id="pref-langue"
                value={language}
                onChange={(e) => setLanguageDraft(e.target.value as 'fr' | 'en')}
                className="h-[46px] min-w-[200px] rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[15px] font-bold text-ink">Thème</span>
                <span className="text-[13px] text-subtle">Clair, sombre ou selon votre appareil</span>
              </span>
              <span role="group" aria-label="Thème" className="flex gap-1 rounded-[22px] bg-surface-soft p-1">
                {THEME_OPTIONS.map((opt) => {
                  const active = mountedTheme ? (theme ?? 'system') === opt.id : opt.id === 'system'
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTheme(opt.id)}
                      className={`min-h-[38px] rounded-full px-4 text-[13px] ${
                        active ? 'bg-surface font-bold text-ink shadow-seg' : 'bg-transparent font-semibold text-ink-3'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </span>
            </div>
          </section>
        ) : null}

        {activeTab === 'securite' ? (
          <div className="flex flex-wrap items-start gap-5">
            <section className="flex flex-[3_1_420px] flex-col gap-4 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">Changer le mot de passe</h2>
              <PasswordForm idPrefix="securite-desktop" />
            </section>
            <section className="flex flex-[2_1_300px] flex-col gap-3 rounded-panel border border-danger-border bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-danger-strong">Zone sensible</h2>
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(true)}
                className="flex min-h-[46px] items-center justify-center rounded-full border border-line-strong text-sm font-bold text-ink"
              >
                Se déconnecter
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex min-h-[46px] items-center justify-center rounded-full bg-danger-bg text-sm font-bold text-danger-strong"
              >
                Supprimer mon compte
              </button>
              <span className="text-xs leading-relaxed text-subtle">
                La suppression efface définitivement vos articles, ventes, factures et clients.
              </span>
            </section>
          </div>
        ) : null}
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div className="flex flex-col gap-5 md:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Retour"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </Link>
          <h1 className="text-[22px] font-bold text-ink">Paramètres</h1>
        </div>

        <div className="flex items-center gap-3.5 rounded-tile border border-line bg-surface p-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
            {avatarInitials}
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-base font-bold text-ink">{sourceFullName || user?.username}</span>
            <span className="text-[13px] text-subtle">{user?.email}</span>
          </span>
          <button
            type="button"
            onClick={() => setMobileEditProfileOpen(true)}
            className="flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-ink"
          >
            Modifier
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">Entreprise</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <button
              type="button"
              onClick={() => setMobileCompanyOpen(true)}
              className="flex min-h-14 items-center gap-3 border-b border-divider px-4 text-left"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">Profil de l’entreprise</span>
                <span className="text-xs text-subtle">Logo, statut légal, compte bancaire</span>
              </span>
              <ChevronRight className="size-[18px] text-subtle" />
            </button>
            <Link href="/collaborators" className="flex min-h-14 items-center gap-3 px-4">
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">Collaborateurs</span>
                <span className="text-xs text-subtle">{collaboratorCount} membres · parts et rôles</span>
              </span>
              <span className="flex">
                {collaboratorAvatars.map((c, i) => {
                  const cycle = AVATAR_CYCLE[i % AVATAR_CYCLE.length]
                  return (
                    <span
                      key={c.id}
                      className={`flex size-7 items-center justify-center rounded-[14px] border-2 border-surface text-[11px] font-bold ${cycle.bg} ${cycle.text}`}
                      style={i > 0 ? { marginLeft: -8 } : undefined}
                    >
                      {getInitials(c.name)}
                    </span>
                  )
                })}
              </span>
              <ChevronRight className="size-[18px] text-subtle" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">Préférences</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <div className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <label htmlFor="pref-devise-m" className="flex-1 text-[15px] font-semibold text-ink">
                Devise
              </label>
              <select
                id="pref-devise-m"
                value={currency}
                onChange={async (e) => {
                  const value = e.target.value
                  setCurrency(value)
                  try {
                    await updateSettings({ currency: value })
                  } catch {
                    setCurrency(settings?.currency ?? 'FCFA')
                  }
                }}
                className="min-h-10 border-0 bg-transparent text-right text-[15px] text-ink-2"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-h-14 items-center gap-3 border-b border-divider py-1.5 pl-4 pr-3">
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">Seuil de stock faible</span>
                <span className="text-xs text-subtle">Alerte sous ce nombre</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    const value = Math.max(0, threshold - 1)
                    setThreshold(value)
                    try {
                      await updateSettings({ low_stock_threshold: value })
                    } catch {
                      setThreshold(settings?.low_stock_threshold ?? 5)
                    }
                  }}
                  aria-label="Diminuer le seuil"
                  className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-canvas text-lg font-bold text-ink"
                >
                  −
                </button>
                <span aria-live="polite" className="w-8 text-center text-base font-bold text-ink">
                  {threshold}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const value = threshold + 1
                    setThreshold(value)
                    try {
                      await updateSettings({ low_stock_threshold: value })
                    } catch {
                      setThreshold(settings?.low_stock_threshold ?? 5)
                    }
                  }}
                  aria-label="Augmenter le seuil"
                  className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-canvas text-lg font-bold text-ink"
                >
                  +
                </button>
              </span>
            </div>
            <div className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <label htmlFor="pref-langue-m" className="flex-1 text-[15px] font-semibold text-ink">
                Langue
              </label>
              <select
                id="pref-langue-m"
                value={language}
                onChange={async (e) => {
                  const value = e.target.value as 'fr' | 'en'
                  setLanguageDraft(value)
                  try {
                    await updateSettings({ language: value })
                  } catch {
                    setLanguageDraft((settings?.language as 'fr' | 'en') ?? 'fr')
                  }
                }}
                className="min-h-10 border-0 bg-transparent text-right text-[15px] text-ink-2"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-h-14 items-center gap-3 px-4">
              <span id="dark-mode-label" className="flex-1 text-[15px] font-semibold text-ink">
                Thème sombre
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={mountedTheme ? resolvedTheme === 'dark' : false}
                aria-labelledby="dark-mode-label"
                onClick={() => setTheme((mountedTheme ? resolvedTheme : 'light') === 'dark' ? 'light' : 'dark')}
                className="flex p-[3px]"
                style={{
                  width: 52,
                  height: 32,
                  borderRadius: 16,
                  justifyContent: mountedTheme && resolvedTheme === 'dark' ? 'flex-end' : 'flex-start',
                  background: mountedTheme && resolvedTheme === 'dark' ? '#5B3FE6' : '#C9C9D6',
                }}
              >
                <span
                  className="rounded-full bg-white"
                  style={{ width: 26, height: 26, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">Compte</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <Link href="/notifications" className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <span className="flex-1 text-[15px] font-semibold text-ink">Notifications</span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-brand-100 px-2.5 py-[3px] text-xs font-bold text-brand-700">
                  {unreadCount}
                </span>
              ) : null}
              <ChevronRight className="size-[18px] text-subtle" />
            </Link>
            <button
              type="button"
              onClick={() => setMobilePasswordOpen(true)}
              className="flex min-h-14 items-center gap-3 border-b border-divider px-4 text-left"
            >
              <span className="flex-1 text-[15px] font-semibold text-ink">Changer le mot de passe</span>
              <ChevronRight className="size-[18px] text-subtle" />
            </button>
            <button
              type="button"
              onClick={() => setLogoutDialogOpen(true)}
              className="flex min-h-14 items-center px-4 text-left text-[15px] font-bold text-danger"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      {/* ============================= Bottom sheets (mobile) ============================= */}
      <Sheet open={mobileEditProfileOpen} onOpenChange={setMobileEditProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">Modifier le profil</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ProfileFields
              fullName={fullName}
              onFullNameChange={setFullName}
              email={email}
              onEmailChange={setEmail}
              avatarLabel={avatarInitials}
              photoPreview={photoPreview}
              onPickPhoto={handlePickPhoto}
              idPrefix="profil-mobile"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-5 w-full"
            disabled={!profileDirty || saving}
            onClick={async () => {
              await handleSave()
              setMobileEditProfileOpen(false)
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileCompanyOpen} onOpenChange={setMobileCompanyOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">Profil de l’entreprise</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CompanyFields
              draft={companyDraft}
              onChange={setCompanyDraft}
              logoPreview={logoPreview}
              onPickLogo={handlePickLogo}
              idPrefix="entreprise-mobile"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-5 w-full"
            disabled={!companyDirty || saving}
            onClick={async () => {
              setSaving(true)
              try {
                if (logoFile) {
                  await uploadCompanyLogo(logoFile)
                  setLogoFile(null)
                }
                await updateCompany(companyDraft)
                await queryClient.invalidateQueries({ queryKey: keys.settings.company() })
                toast.success('Modifications enregistrées')
                setMobileCompanyOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Échec de l’enregistrement')
                setCompanyDraft(sourceCompanyDraft)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={mobilePasswordOpen} onOpenChange={setMobilePasswordOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">Changer le mot de passe</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PasswordForm idPrefix="securite-mobile" onSuccess={() => setMobilePasswordOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ============================= Dialogues ============================= */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>Vous devrez vous reconnecter pour accéder à votre compte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogout}>Se déconnecter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteConfirmText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression efface définitivement vos articles, ventes, factures et clients. Tapez «&nbsp;{company?.name ?? ''}&nbsp;»
              pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={company?.name ?? "Nom de l'entreprise"}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!company?.name || deleteConfirmText !== company.name}
              onClick={() => {
                setDeleteDialogOpen(false)
                toast.error('La suppression de compte n’est pas encore disponible.')
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
