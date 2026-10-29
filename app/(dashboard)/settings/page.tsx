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
import { useLanguage } from '@/lib/i18n/context/LanguageContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { keys } from '@/lib/query-keys'
import { useNotifications } from '@/hooks/useNotifications'
import { updateUserProfile, updateUserPassword } from '@/lib/auth'
import { getCompany, updateCompany, uploadCompanyLogo, type Company } from '@/lib/services/company'
import {
  getReceiptSettings,
  updateReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
  type ReceiptWidth,
} from '@/lib/services/receipt-settings'
import { buildReceipt, type ReceiptOperationInput, type ReceiptModel } from '@/lib/receipt/build-receipt'
import { generateReceiptQrDataUrl } from '@/lib/receipt/qr'
import { printReceiptModel } from '@/lib/receipt/print-receipt'
import { encodeReceiptEscPos } from '@/lib/receipt/escpos-encoder'
import { isWebBluetoothSupported } from '@/lib/receipt/bluetooth-transport'
import { useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'
import {
  readDefaultPrintMode,
  writeDefaultPrintMode,
  readCompatibilityMode,
  writeCompatibilityMode,
  readCutPaper,
  writeCutPaper,
  type DefaultPrintMode,
} from '@/lib/receipt/printer-preferences'
import { ReceiptView } from '@/components/waelly/receipt-view'
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

type TabId = 'profil' | 'entreprise' | 'preferences' | 'ticket' | 'securite'

const TABS: { id: TabId; labelKey: string }[] = [
  { id: 'profil', labelKey: 'settings.tabs.profile' },
  { id: 'entreprise', labelKey: 'settings.tabs.company' },
  { id: 'preferences', labelKey: 'settings.tabs.preferences' },
  { id: 'ticket', labelKey: 'settings.tabs.receipt' },
  { id: 'securite', labelKey: 'settings.tabs.security' },
]

const RECEIPT_WIDTH_OPTIONS: { value: ReceiptWidth; labelKey: string }[] = [
  { value: '58mm', labelKey: 'settings.receipt.width58' },
  { value: '80mm', labelKey: 'settings.receipt.width80' },
]

// FCFA (XOF)/Euro/Dollar : le CODE devise (abréviation) reste identique quelle
// que soit la langue par convention internationale — seul le nom complet
// pourrait changer ("Euro" est déjà identique en fr/en). Aucune clé i18n
// nécessaire ici.
const CURRENCY_OPTIONS = [
  { value: 'FCFA', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
]
// Le nom d'une langue s'affiche toujours DANS cette langue, jamais traduit
// ("Français" et "English" restent tels quels, quelle que soit la langue de
// l'interface) — convention standard des sélecteurs de langue.
const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' }, // i18n:allow — nom de langue affiché dans sa propre langue, jamais traduit
  { value: 'en', label: 'English' },
]
// Listes alignées sur l'onboarding (app/(onboarding)/onboarding/entreprise)
// pour qu'un même champ ait la même liste de choix partout dans l'app.
// Valeurs stockées en base telles quelles (pas encore de clé i18n séparée
// valeur/affichage pour ces données métier — restent en français pour
// l'instant, y compris en anglais ; voir rapport final du lot).
const SECTOR_OPTIONS = ['Mode & textile', 'Alimentation', 'Cosmétique', 'Électronique', 'Restauration', 'Services', 'Autre'] // i18n:allow — valeurs métier stockées en base, pas encore de clé valeur/affichage séparée
const LEGAL_STATUS_OPTIONS = ['Entreprise individuelle', 'SARL', 'SA', 'Auto-entrepreneur']
const THEME_OPTIONS: { id: 'light' | 'dark' | 'system'; labelKey: string }[] = [
  { id: 'light', labelKey: 'settings.preferences.themeLight' },
  { id: 'dark', labelKey: 'settings.preferences.themeDark' },
  { id: 'system', labelKey: 'settings.preferences.themeAuto' },
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
  phone: string
  legal_status: string
  bank_account_number: string
  tax_id: string
}

function companyToDraft(company: Company | null | undefined): CompanyDraft {
  return {
    name: company?.name ?? '',
    sector: company?.sector ?? '',
    headquarters: company?.headquarters ?? '',
    phone: company?.phone ?? '',
    legal_status: company?.legal_status ?? '',
    bank_account_number: company?.bank_account_number ?? '',
    tax_id: company?.tax_id ?? '',
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
  t,
}: {
  fullName: string
  onFullNameChange: (v: string) => void
  email: string
  onEmailChange: (v: string) => void
  avatarLabel: string
  photoPreview: string | null
  onPickPhoto: (file: File) => void
  idPrefix: string
  t: ReturnType<typeof useTranslation>['t']
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
          {t('settings.profile.changePhoto')}
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
            {t('settings.profile.fullName')}
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
            {t('settings.profile.email')}
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
  t,
}: {
  draft: CompanyDraft
  onChange: (next: CompanyDraft) => void
  logoPreview: string | null
  onPickLogo: (file: File) => void
  idPrefix: string
  t: ReturnType<typeof useTranslation>['t']
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
          {t('settings.company.changeLogo')}
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
            {t('settings.company.name')}
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
            {t('settings.company.sector')}
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
            {t('settings.company.headquarters')}
          </label>
          <input
            id={`${idPrefix}-hq`}
            value={draft.headquarters}
            onChange={(e) => onChange({ ...draft, headquarters: e.target.value })}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-phone`} className="text-[13px] font-semibold text-ink">
            {t('settings.company.phone')}
          </label>
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            placeholder={t('settings.company.phonePlaceholder')}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-legal`} className="text-[13px] font-semibold text-ink">
            {t('settings.company.legalStatus')}
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
            {t('settings.company.bankAccount')}
          </label>
          <input
            id={`${idPrefix}-iban`}
            value={draft.bank_account_number}
            onChange={(e) => onChange({ ...draft, bank_account_number: e.target.value })}
            placeholder={t('settings.company.bankAccountPlaceholder')}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-tax-id`} className="text-[13px] font-semibold text-ink">
            {t('settings.company.taxId')}
          </label>
          <input
            id={`${idPrefix}-tax-id`}
            value={draft.tax_id}
            onChange={(e) => onChange({ ...draft, tax_id: e.target.value })}
            placeholder={t('settings.company.taxIdPlaceholder')}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
        </div>
      </div>
    </div>
  )
}

/** Un seul exemple, jamais envoyé au serveur — juste de quoi faire vivre l'aperçu en direct des réglages du ticket. */
function sampleReceiptOperation(t: ReturnType<typeof useTranslation>['t']): ReceiptOperationInput {
  return {
    code: 'V-261028-0042',
    date: '2026-10-28T14:32:00Z',
    paymentMethodLabel: t('wallet.deposit.paymentMethodCash'),
    totalAmount: 24000,
    amountReceived: 25000,
    changeGiven: 1000,
    clientName: null,
    authorName: null,
    lines: [{ name: t('settings.receipt.sampleArticle'), quantity: 2, unitPrice: 12000, amount: 24000 }],
  }
}

const RECEIPT_TOGGLES: { key: keyof ReceiptSettings; labelKey: string }[] = [
  { key: 'show_logo', labelKey: 'settings.receipt.showLogo' },
  { key: 'show_address', labelKey: 'settings.receipt.showAddress' },
  { key: 'show_phone', labelKey: 'settings.receipt.showPhone' },
  { key: 'show_tax_id', labelKey: 'settings.receipt.showTaxId' },
  { key: 'show_qr', labelKey: 'settings.receipt.showQr' },
  { key: 'show_waelly_mention', labelKey: 'settings.receipt.showWaellyMention' },
  { key: 'auto_print', labelKey: 'settings.receipt.autoPrint' },
]

/** Réglages "Ticket de caisse" + aperçu en direct — réutilisé onglet ordinateur / bottom sheet mobile (même principe que CompanyFields). */
function ReceiptSettingsFields({
  draft,
  onChange,
  company,
  idPrefix,
  t,
  language,
  currency,
}: {
  draft: ReceiptSettings
  onChange: (next: ReceiptSettings) => void
  company: Company | null | undefined
  idPrefix: string
  t: ReturnType<typeof useTranslation>['t']
  language: AppLanguage
  currency: string | undefined
}) {
  const [testPrinting, setTestPrinting] = React.useState(false)

  const model = React.useMemo(
    () =>
      buildReceipt(
        sampleReceiptOperation(t),
        {
          name: company?.name || 'Waelly', // i18n:allow — nom de secours uniquement si l'entreprise n'a pas encore été configurée
          logoUrl: company?.logo_url ?? null,
          address: company?.headquarters ?? null,
          phone: company?.phone ?? null,
          taxId: company?.tax_id ?? null,
        },
        {
          width: draft.width,
          showLogo: draft.show_logo,
          showAddress: draft.show_address,
          showPhone: draft.show_phone,
          showTaxId: draft.show_tax_id,
          footerMessage: draft.footer_message,
          showQr: draft.show_qr,
          showWaellyMention: draft.show_waelly_mention,
        },
        {
          language,
          currency,
          labels: {
            ticketNumber: t('wallet.receipt.ticketNumber'),
            cashier: t('wallet.receipt.cashier'),
            client: t('wallet.checkout.clientLabel'),
            total: t('wallet.receipt.total'),
            paidBy: t('wallet.receipt.paidBy'),
            received: t('wallet.receipt.received'),
            changeGiven: t('wallet.checkout.changeLabel'),
            duplicate: t('wallet.receipt.duplicate'),
            paymentMethodUnknown: t('wallet.detail.paymentMethodUnknown'),
            defaultFooter: t('wallet.receipt.defaultFooter'),
            waellyMention: 'Waelly', // i18n:allow — nom de marque, jamais traduit
          },
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, company, language, currency]
  )

  const handleTestPrint = async () => {
    setTestPrinting(true)
    try {
      const qrDataUrl = draft.show_qr ? await generateReceiptQrDataUrl('V-261028-0042') : null
      const started = printReceiptModel(model, qrDataUrl)
      if (!started) toast.error(t('wallet.receipt.printFailed'))
    } finally {
      setTestPrinting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4.5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">{t('settings.receipt.widthLabel')}</span>
          <div className="flex gap-2">
            {RECEIPT_WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...draft, width: opt.value })}
                aria-pressed={draft.width === opt.value}
                className={`flex h-11 flex-1 items-center justify-center rounded-field border text-sm font-semibold ${
                  draft.width === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong text-ink-2'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          {RECEIPT_TOGGLES.map((toggle) => {
            const on = Boolean(draft[toggle.key])
            return (
              <div key={toggle.key} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span id={`${idPrefix}-${toggle.key}`} className="flex-1 text-sm font-semibold text-ink">
                  {t(toggle.labelKey)}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={`${idPrefix}-${toggle.key}`}
                  onClick={() => onChange({ ...draft, [toggle.key]: !on })}
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
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-footer`} className="text-[13px] font-semibold text-ink">
            {t('settings.receipt.footerMessageLabel')}
          </label>
          <input
            id={`${idPrefix}-footer`}
            value={draft.footer_message ?? ''}
            onChange={(e) => onChange({ ...draft, footer_message: e.target.value.slice(0, 120) })}
            placeholder={t('settings.receipt.footerMessagePlaceholder')}
            maxLength={120}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
          <span className="self-end text-xs text-subtle">{(draft.footer_message ?? '').length}/120</span>
        </div>

        <Button type="button" variant="secondary" className="h-11 self-start px-5" onClick={handleTestPrint} disabled={testPrinting}>
          {t('settings.receipt.testPrintButton')}
        </Button>

        <BluetoothPrinterSection idPrefix={idPrefix} t={t} charsPerLine={draft.width === '80mm' ? 48 : 32} />
      </div>

      <div className="flex w-full flex-col items-center gap-2 rounded-panel border border-line bg-canvas p-4 lg:w-auto">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{t('settings.receipt.previewLabel')}</span>
        <div className="rounded-tile bg-white p-3 shadow-sm">
          <ReceiptView model={model} />
        </div>
      </div>
    </div>
  )
}

/**
 * "Imprimante Bluetooth" (étape 2 du chantier ticket de caisse) — impression
 * ESC/POS directe, sans fenêtre d'impression. Web Bluetooth n'existe QUE sur
 * Chrome/Chromium (Android et ordinateur) — absent sur Safari/iOS : cette
 * section entière se masque (return null) si indisponible, jamais un bouton
 * mort. Mode par défaut, mode compatibilité et coupe papier sont des
 * préférences PROPRES À CET APPAREIL (un appairage Bluetooth ne se
 * synchronise pas entre appareils) — localStorage, pas receipt_settings.
 */
function BluetoothPrinterSection({
  idPrefix,
  t,
  charsPerLine,
}: {
  idPrefix: string
  t: ReturnType<typeof useTranslation>['t']
  charsPerLine: 32 | 48
}) {
  const [supported, setSupported] = React.useState(false)
  const [showAllDevices, setShowAllDevices] = React.useState(false)
  const [defaultMode, setDefaultModeState] = React.useState<DefaultPrintMode>('classic')
  const [compatibilityMode, setCompatibilityModeState] = React.useState(false)
  const [cutPaper, setCutPaperState] = React.useState(false)
  const [testPrinting, setTestPrinting] = React.useState(false)

  const status = useBluetoothPrinterStore((s) => s.status)
  const deviceName = useBluetoothPrinterStore((s) => s.deviceName)
  const batteryLevel = useBluetoothPrinterStore((s) => s.batteryLevel)
  const connect = useBluetoothPrinterStore((s) => s.connect)
  const reconnect = useBluetoothPrinterStore((s) => s.reconnect)
  const disconnect = useBluetoothPrinterStore((s) => s.disconnect)
  const printBytes = useBluetoothPrinterStore((s) => s.print)
  const init = useBluetoothPrinterStore((s) => s.init)

  React.useEffect(() => {
    setSupported(isWebBluetoothSupported())
    setDefaultModeState(readDefaultPrintMode())
    setCompatibilityModeState(readCompatibilityMode())
    setCutPaperState(readCutPaper())
    init()
  }, [init])

  if (!supported) {
    return (
      <div className="flex flex-col gap-2 border-t border-divider pt-4.5">
        <h3 className="text-[15px] font-bold text-ink">{t('settings.receipt.bluetoothTitle')}</h3>
        <p className="text-[13px] text-subtle">{t('settings.receipt.bluetoothUnsupported')}</p>
      </div>
    )
  }

  const handleConnect = async () => {
    try {
      await connect(showAllDevices)
    } catch {
      toast.error(t('settings.receipt.bluetoothConnectFailed'))
    }
  }

  const handleReconnect = async () => {
    try {
      await reconnect()
    } catch {
      toast.error(t('settings.receipt.bluetoothConnectFailed'))
    }
  }

  const handleTestPrint = async () => {
    setTestPrinting(true)
    try {
      const testModel: ReceiptModel = {
        width: charsPerLine === 48 ? '80mm' : '58mm',
        charsPerLine,
        rows: [
          { kind: 'text', text: t('settings.receipt.bluetoothTestLine'), align: 'center', bold: true },
          { kind: 'text', text: new Date().toLocaleString(), align: 'center' },
        ],
      }
      const bytes = encodeReceiptEscPos(testModel, { compatibilityMode, cutPaper })
      const result = await printBytes(bytes)
      if (!result.ok) toast.error(t('settings.receipt.bluetoothNotConnected'))
    } finally {
      setTestPrinting(false)
    }
  }

  const statusLabel =
    status === 'connected'
      ? t('settings.receipt.bluetoothConnected', { name: deviceName ?? '' })
      : status === 'connecting'
        ? t('settings.receipt.bluetoothConnecting')
        : t('settings.receipt.bluetoothDisconnected')

  const toggleRow = (id: string, label: string, value: boolean, onToggle: () => void, lastRow = false) => (
    <div className={`flex items-center gap-3 py-2.5 ${lastRow ? '' : 'border-b border-line'}`}>
      <span id={id} className="flex-1 text-sm font-semibold text-ink">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={id}
        onClick={onToggle}
        className="flex p-[3px]"
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          justifyContent: value ? 'flex-end' : 'flex-start',
          background: value ? '#5B3FE6' : '#C9C9D6',
        }}
      >
        <span className="rounded-full bg-white" style={{ width: 24, height: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4.5">
      <h3 className="text-[15px] font-bold text-ink">{t('settings.receipt.bluetoothTitle')}</h3>

      <div className="flex items-center gap-2 rounded-tile bg-surface-soft px-4 py-3">
        <span className={`size-2.5 shrink-0 rounded-full ${status === 'connected' ? 'bg-success-strong' : 'bg-line-strong'}`} />
        <span className="flex-1 text-sm font-semibold text-ink">{statusLabel}</span>
        {status === 'connected' && batteryLevel != null && batteryLevel <= 20 ? (
          <span className="text-xs font-semibold text-warning">{t('settings.receipt.bluetoothLowBattery')}</span>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={showAllDevices}
          onChange={(e) => setShowAllDevices(e.target.checked)}
          className="size-4"
        />
        {t('settings.receipt.bluetoothShowAllDevices')}
      </label>

      <div className="flex flex-wrap gap-2">
        {status === 'connected' ? (
          <Button type="button" variant="secondary" className="h-11 px-5" onClick={disconnect}>
            {t('settings.receipt.bluetoothDisconnectButton')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" className="h-11 px-5" onClick={handleConnect} disabled={status === 'connecting'}>
              {t('settings.receipt.bluetoothConnectButton')}
            </Button>
            <Button type="button" variant="secondary" className="h-11 px-5" onClick={handleReconnect} disabled={status === 'connecting'}>
              {t('settings.receipt.bluetoothReconnectButton')}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="secondary"
          className="h-11 px-5"
          onClick={handleTestPrint}
          disabled={testPrinting || status !== 'connected'}
        >
          {t('settings.receipt.bluetoothTestPrintButton')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">{t('settings.receipt.defaultModeLabel')}</span>
        <div className="flex gap-2">
          {(['bluetooth', 'classic'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setDefaultModeState(mode)
                writeDefaultPrintMode(mode)
              }}
              aria-pressed={defaultMode === mode}
              className={`flex h-11 flex-1 items-center justify-center rounded-field border text-sm font-semibold ${
                defaultMode === mode ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong text-ink-2'
              }`}
            >
              {mode === 'bluetooth' ? t('settings.receipt.defaultModeBluetooth') : t('settings.receipt.defaultModeClassic')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {toggleRow(`${idPrefix}-compat`, t('settings.receipt.compatibilityModeLabel'), compatibilityMode, () => {
          const next = !compatibilityMode
          setCompatibilityModeState(next)
          writeCompatibilityMode(next)
        })}
        {toggleRow(
          `${idPrefix}-cut`,
          t('settings.receipt.cutPaperLabel'),
          cutPaper,
          () => {
            const next = !cutPaper
            setCutPaperState(next)
            writeCutPaper(next)
          },
          true
        )}
      </div>
    </div>
  )
}

/** Formulaire de changement de mot de passe — entièrement autonome (son propre bouton « Mettre à jour »), réutilisé carte ordinateur / bottom sheet mobile. */
function PasswordForm({ idPrefix, onSuccess, t }: { idPrefix: string; onSuccess?: () => void; t: ReturnType<typeof useTranslation>['t'] }) {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNext, setShowNext] = React.useState(false)
  const [errors, setErrors] = React.useState<{ next?: string; confirm?: string }>({})
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async () => {
    const nextErrors: { next?: string; confirm?: string } = {}
    if (next.length < 8) nextErrors.next = t('settings.security.passwordMinLength')
    if (confirm !== next) nextErrors.confirm = t('settings.security.passwordMismatch')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await updateUserPassword({
        current_password: current,
        new_password: next,
        new_password_confirmation: confirm,
      })
      toast.success(t('settings.security.passwordUpdated'))
      setCurrent('')
      setNext('')
      setConfirm('')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.security.passwordUpdateFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-current`} className="text-[13px] font-semibold text-ink">
          {t('settings.security.currentPassword')}
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
            aria-label={showCurrent ? t('settings.security.hidePassword') : t('settings.security.showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
          >
            {showCurrent ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-next`} className="text-[13px] font-semibold text-ink">
            {t('settings.security.newPassword')}
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
              aria-label={showNext ? t('settings.security.hidePassword') : t('settings.security.showPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
            >
              {showNext ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
          {errors.next ? <p className="text-xs text-danger-strong">{errors.next}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-confirm`} className="text-[13px] font-semibold text-ink">
            {t('settings.security.confirmPassword')}
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
        {t('common.update')}
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
  const { t } = useTranslation()
  const { language, setLanguage, pseudoMode, togglePseudoMode } = useLanguage()
  const { unreadCount } = useNotifications()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mountedTheme, setMountedTheme] = React.useState(false)
  React.useEffect(() => setMountedTheme(true), [])

  const urlTab = searchParams.get('tab') as TabId | null
  const activeTab: TabId = urlTab && TABS.some((tab) => tab.id === urlTab) ? urlTab : 'profil'
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
  const { data: receiptSettingsData } = useQuery({
    queryKey: keys.settings.receipt(),
    queryFn: getReceiptSettings,
    staleTime: 10 * 60 * 1000,
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
  // La langue n'est PAS un brouillon : elle s'applique immédiatement (voir
  // le sélecteur plus bas, qui appelle setLanguage() directement) — exigence
  // explicite du correctif i18n, contrairement à devise/seuil qui restent
  // en attente d'un clic sur "Enregistrer".
  const [currency, setCurrency] = React.useState('FCFA')
  const [threshold, setThreshold] = React.useState(5)
  React.useEffect(() => {
    if (settings) {
      setCurrency(settings.currency)
      setThreshold(settings.low_stock_threshold)
    }
  }, [settings])
  const prefsDirty =
    !!settings && (currency !== settings.currency || threshold !== settings.low_stock_threshold)

  // ---- Brouillon Ticket de caisse ----
  const [receiptDraft, setReceiptDraft] = React.useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  React.useEffect(() => {
    if (receiptSettingsData) setReceiptDraft(receiptSettingsData)
  }, [receiptSettingsData])
  const receiptDirty = !!receiptSettingsData && JSON.stringify(receiptDraft) !== JSON.stringify(receiptSettingsData)

  const [saving, setSaving] = React.useState(false)
  const [mobileEditProfileOpen, setMobileEditProfileOpen] = React.useState(false)
  const [mobileCompanyOpen, setMobileCompanyOpen] = React.useState(false)
  const [mobileTicketOpen, setMobileTicketOpen] = React.useState(false)
  const [mobilePasswordOpen, setMobilePasswordOpen] = React.useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('')

  const isDirty =
    activeTab === 'profil'
      ? profileDirty
      : activeTab === 'entreprise'
        ? companyDirty
        : activeTab === 'preferences'
          ? prefsDirty
          : activeTab === 'ticket'
            ? receiptDirty
            : false

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
        toast.success(t('settings.saveSuccess'))
      } else if (activeTab === 'entreprise') {
        if (logoFile) {
          await uploadCompanyLogo(logoFile)
          setLogoFile(null)
        }
        await updateCompany(companyDraft)
        await queryClient.invalidateQueries({ queryKey: keys.settings.company() })
        toast.success(t('settings.saveSuccess'))
      } else if (activeTab === 'preferences') {
        await updateSettings({ currency, low_stock_threshold: threshold })
      } else if (activeTab === 'ticket') {
        const updated = await updateReceiptSettings(receiptDraft)
        setReceiptDraft(updated)
        await queryClient.invalidateQueries({ queryKey: keys.settings.receipt() })
        toast.success(t('settings.saveSuccess'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
      if (activeTab === 'entreprise') setCompanyDraft(sourceCompanyDraft)
      if (activeTab === 'profil') {
        setFullName(sourceFullName)
        setEmail(user?.email ?? '')
      }
      if (activeTab === 'ticket') setReceiptDraft(receiptSettingsData ?? DEFAULT_RECEIPT_SETTINGS)
    } finally {
      setSaving(false)
    }
  }

  const avatarInitials = getInitials(sourceFullName || user?.username || '?')
  const providerConnected = (provider: 'google' | 'facebook') => user?.provider === provider
  const notConfigured = () => toast.info(t('settings.profile.notAvailable'))

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
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('settings.pageTitle')}</h1>
            <span className="text-sm text-subtle">{t('settings.pageSubtitle')}</span>
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
              {t('common.save')}
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label={t('settings.sectionsAria')}
          className="glass self-start flex flex-wrap gap-1 rounded-panel p-1"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            const idx = TABS.findIndex((tab) => tab.id === activeTab)
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
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'profil' ? (
          <div className="flex flex-wrap items-start gap-5">
            <section className="flex flex-[3_1_460px] flex-col gap-4.5 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">{t('settings.profile.title')}</h2>
              <ProfileFields
                fullName={fullName}
                onFullNameChange={setFullName}
                email={email}
                onEmailChange={setEmail}
                avatarLabel={avatarInitials}
                photoPreview={photoPreview}
                onPickPhoto={handlePickPhoto}
                idPrefix="profil-desktop"
                t={t}
              />
            </section>
            <section className="flex flex-[2_1_300px] flex-col gap-3 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">{t('settings.profile.connectedAccounts')}</h2>
              <div className="flex items-center gap-3 border-b border-divider py-2.5">
                <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-ink-3 font-bold text-ink">
                  G
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">Google</span>
                  <span className={`text-xs ${providerConnected('google') ? 'text-success-strong' : 'text-subtle'}`}>
                    {providerConnected('google') ? t('settings.profile.connected') : t('settings.profile.notConnected')}
                  </span>
                </span>
                {providerConnected('google') ? (
                  <Button type="button" variant="secondary" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    {t('settings.profile.disconnect')}
                  </Button>
                ) : (
                  <Button type="button" variant="black" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    {t('settings.profile.connect')}
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
                    {providerConnected('facebook') ? t('settings.profile.connected') : t('settings.profile.notConnected')}
                  </span>
                </span>
                {providerConnected('facebook') ? (
                  <Button type="button" variant="secondary" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    {t('settings.profile.disconnect')}
                  </Button>
                ) : (
                  <Button type="button" variant="black" className="h-[38px] px-3.5 text-[13px]" onClick={notConfigured}>
                    {t('settings.profile.connect')}
                  </Button>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'entreprise' ? (
          <section className="flex flex-col gap-4.5 rounded-panel bg-surface p-6 shadow-card">
            <h2 className="text-lg font-bold text-ink">{t('settings.company.title')}</h2>
            <CompanyFields
              draft={companyDraft}
              onChange={setCompanyDraft}
              logoPreview={logoPreview}
              onPickLogo={handlePickLogo}
              idPrefix="entreprise-desktop"
              t={t}
            />
          </section>
        ) : null}

        {activeTab === 'preferences' ? (
          <section className="flex flex-col rounded-panel bg-surface px-6 py-0.5 shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-divider py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <label htmlFor="pref-devise" className="text-[15px] font-bold text-ink">
                  {t('settings.preferences.currency')}
                </label>
                <span className="text-[13px] text-subtle">{t('settings.preferences.currencyHelp')}</span>
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
                <span className="text-[15px] font-bold text-ink">{t('settings.preferences.lowStockThreshold')}</span>
                <span className="text-[13px] text-subtle">{t('settings.preferences.lowStockThresholdHelp')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setThreshold((v) => Math.max(0, v - 1))}
                  aria-label={t('settings.preferences.decreaseThreshold')}
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
                  aria-label={t('settings.preferences.increaseThreshold')}
                  className="flex size-[42px] items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white"
                >
                  +
                </button>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-divider py-4.5">
              <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                <label htmlFor="pref-langue" className="text-[15px] font-bold text-ink">
                  {t('settings.preferences.language')}
                </label>
                <span className="text-[13px] text-subtle">{t('settings.preferences.languageHelp')}</span>
              </span>
              <select
                id="pref-langue"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
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
                <span className="text-[15px] font-bold text-ink">{t('settings.preferences.theme')}</span>
                <span className="text-[13px] text-subtle">{t('settings.preferences.themeHelp')}</span>
              </span>
              <span role="group" aria-label={t('settings.preferences.theme')} className="flex gap-1 rounded-[22px] bg-surface-soft p-1">
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
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </span>
            </div>

            {/* Outil de développement, jamais affiché en production — pas de clé i18n (i18n:allow sur chaque ligne, texte volontairement non traduit). */}
            {process.env.NODE_ENV !== 'production' ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-divider py-4.5">
                <span className="flex flex-[1_1_240px] flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-ink">Pseudo-langue xx (dev)</span> {/* i18n:allow */}
                  <span className="text-[13px] text-subtle">
                    Entoure chaque texte traduit — tout texte sans crochets est en dur, non traduit. {/* i18n:allow */}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pseudoMode}
                  onClick={togglePseudoMode}
                  className={`flex min-h-[38px] items-center rounded-full px-4 text-[13px] font-bold ${
                    pseudoMode ? 'bg-brand-500 text-white' : 'border border-line-strong bg-surface text-ink'
                  }`}
                >
                  {pseudoMode ? 'On' : 'Off'}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'ticket' ? (
          <section className="flex flex-col gap-4.5 rounded-panel bg-surface p-6 shadow-card">
            <h2 className="text-lg font-bold text-ink">{t('settings.tabs.receipt')}</h2>
            <ReceiptSettingsFields
              draft={receiptDraft}
              onChange={setReceiptDraft}
              company={company}
              idPrefix="ticket-desktop"
              t={t}
              language={language}
              currency={settings?.currency}
            />
          </section>
        ) : null}

        {activeTab === 'securite' ? (
          <div className="flex flex-wrap items-start gap-5">
            <section className="flex flex-[3_1_420px] flex-col gap-4 rounded-panel bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-ink">{t('settings.security.changePassword')}</h2>
              <PasswordForm idPrefix="securite-desktop" t={t} />
            </section>
            <section className="flex flex-[2_1_300px] flex-col gap-3 rounded-panel border border-danger-border bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-danger-strong">{t('settings.security.dangerZone')}</h2>
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(true)}
                className="flex min-h-[46px] items-center justify-center rounded-full border border-line-strong text-sm font-bold text-ink"
              >
                {t('nav.logout')}
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex min-h-[46px] items-center justify-center rounded-full bg-danger-bg text-sm font-bold text-danger-strong"
              >
                {t('settings.security.deleteAccount')}
              </button>
              <span className="text-xs leading-relaxed text-subtle">
                {t('settings.security.deleteAccountWarning')}
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
            aria-label={t('settings.mobile.backAria')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </Link>
          <h1 className="text-[22px] font-bold text-ink">{t('settings.pageTitle')}</h1>
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
            {t('settings.mobile.edit')}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">{t('settings.mobile.companySection')}</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <button
              type="button"
              onClick={() => setMobileCompanyOpen(true)}
              className="flex min-h-14 items-center gap-3 border-b border-divider px-4 text-left"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">{t('settings.company.title')}</span>
                <span className="text-xs text-subtle">{t('settings.company.mobileSubtitle')}</span>
              </span>
              <ChevronRight className="size-[18px] text-subtle" />
            </button>
            <Link href="/team" className="flex min-h-14 items-center gap-3 px-4">
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">{t('settings.mobile.collaborators')}</span>
                <span className="text-xs text-subtle">{t('settings.mobile.collaboratorsCount', { count: collaboratorCount })}</span>
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
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">{t('settings.tabs.receipt')}</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <button
              type="button"
              onClick={() => setMobileTicketOpen(true)}
              className="flex min-h-14 items-center gap-3 px-4 text-left"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">{t('settings.tabs.receipt')}</span>
                <span className="text-xs text-subtle">{t('settings.receipt.mobileSubtitle')}</span>
              </span>
              <ChevronRight className="size-[18px] text-subtle" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">{t('settings.tabs.preferences')}</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <div className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <label htmlFor="pref-devise-m" className="flex-1 text-[15px] font-semibold text-ink">
                {t('settings.preferences.currency')}
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
                <span className="text-[15px] font-semibold text-ink">{t('settings.preferences.lowStockThreshold')}</span>
                <span className="text-xs text-subtle">{t('settings.preferences.lowStockThresholdHelpShort')}</span>
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
                  aria-label={t('settings.preferences.decreaseThreshold')}
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
                  aria-label={t('settings.preferences.increaseThreshold')}
                  className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-canvas text-lg font-bold text-ink"
                >
                  +
                </button>
              </span>
            </div>
            <div className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <label htmlFor="pref-langue-m" className="flex-1 text-[15px] font-semibold text-ink">
                {t('settings.preferences.language')}
              </label>
              <select
                id="pref-langue-m"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
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
                {t('settings.preferences.themeDarkModeToggle')}
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
          <h2 className="mx-1 text-xs font-bold uppercase tracking-wide text-subtle">{t('settings.mobile.accountSection')}</h2>
          <div className="flex flex-col rounded-tile border border-line bg-surface">
            <Link href="/notifications" className="flex min-h-14 items-center gap-3 border-b border-divider px-4">
              <span className="flex-1 text-[15px] font-semibold text-ink">{t('nav.notifications')}</span>
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
              <span className="flex-1 text-[15px] font-semibold text-ink">{t('settings.security.changePassword')}</span>
              <ChevronRight className="size-[18px] text-subtle" />
            </button>
            <button
              type="button"
              onClick={() => setLogoutDialogOpen(true)}
              className="flex min-h-14 items-center px-4 text-left text-[15px] font-bold text-danger"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* ============================= Bottom sheets (mobile) ============================= */}
      <Sheet open={mobileEditProfileOpen} onOpenChange={setMobileEditProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">{t('settings.profile.editProfile')}</SheetTitle>
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
              t={t}
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
            {t('common.save')}
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileCompanyOpen} onOpenChange={setMobileCompanyOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">{t('settings.company.title')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CompanyFields
              draft={companyDraft}
              onChange={setCompanyDraft}
              logoPreview={logoPreview}
              onPickLogo={handlePickLogo}
              idPrefix="entreprise-mobile"
              t={t}
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
                toast.success(t('settings.saveSuccess'))
                setMobileCompanyOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
                setCompanyDraft(sourceCompanyDraft)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('common.save')}
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileTicketOpen} onOpenChange={setMobileTicketOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">{t('settings.tabs.receipt')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ReceiptSettingsFields
              draft={receiptDraft}
              onChange={setReceiptDraft}
              company={company}
              idPrefix="ticket-mobile"
              t={t}
              language={language}
              currency={settings?.currency}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-5 w-full"
            disabled={!receiptDirty || saving}
            onClick={async () => {
              setSaving(true)
              try {
                const updated = await updateReceiptSettings(receiptDraft)
                setReceiptDraft(updated)
                await queryClient.invalidateQueries({ queryKey: keys.settings.receipt() })
                toast.success(t('settings.saveSuccess'))
                setMobileTicketOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
                setReceiptDraft(receiptSettingsData ?? DEFAULT_RECEIPT_SETTINGS)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('common.save')}
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={mobilePasswordOpen} onOpenChange={setMobilePasswordOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 bg-surface p-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold text-ink">{t('settings.security.changePassword')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PasswordForm idPrefix="securite-mobile" onSuccess={() => setMobilePasswordOpen(false)} t={t} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ============================= Dialogues ============================= */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nav.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('nav.logoutConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogout}>{t('nav.logout')}</AlertDialogAction>
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
            <AlertDialogTitle>{t('settings.security.deleteAccountConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.security.deleteAccountConfirmDescription', { name: company?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={company?.name ?? t('settings.security.deleteAccountPlaceholder')}
            className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!company?.name || deleteConfirmText !== company.name}
              onClick={() => {
                setDeleteDialogOpen(false)
                toast.error(t('settings.security.deleteAccountNotAvailable'))
              }}
            >
              {t('settings.security.deleteAccountConfirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
