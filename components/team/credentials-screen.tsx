'use client'

import * as React from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useAuth } from '@/contexts/AuthContext'
import type { TeamCredentials } from '@/lib/services/team'
import { buildCredentialsMessage, sendCredentialsViaWhatsApp } from '@/lib/team/share-credentials'
import { Button } from '@/components/waelly'

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Best-effort — certains navigateurs/contextes non sécurisés refusent l'accès au presse-papiers.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-3.5 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold text-subtle">{label}</span>
        <span className="truncate text-[15px] font-bold text-ink">{value}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`${t('team.copy')} — ${label}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-2"
      >
        {copied ? <Check className="size-4" strokeWidth={2.2} /> : <Copy className="size-4" strokeWidth={2} />}
      </button>
    </div>
  )
}

interface CredentialsScreenProps {
  name: string
  credentials: TeamCredentials
  onDone: () => void
}

function CredentialsScreen({ name, credentials, onDone }: CredentialsScreenProps) {
  const { t, language } = useTranslation()
  const { user } = useAuth()
  const [copiedAll, setCopiedAll] = React.useState(false)
  const companyName = user?.company?.name ?? ''

  const message = buildCredentialsMessage({
    name,
    companyName,
    loginUrl: credentials.login_url,
    username: credentials.username,
    code: credentials.code,
    language,
  })

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopiedAll(true)
      window.setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      // Best-effort — voir CopyRow.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-ink">{t('team.credentialsTitle')}</h2>
        <p className="text-sm text-subtle">{t('team.credentialsIntro', { name })}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <CopyRow label={t('team.loginLink')} value={credentials.login_url} />
        <CopyRow label={t('team.username')} value={credentials.username} />
        <CopyRow label={t('team.code')} value={credentials.code} />
      </div>

      <Button
        type="button"
        variant="primary"
        className="h-[52px] w-full gap-2"
        onClick={() => sendCredentialsViaWhatsApp(message)}
      >
        <MessageCircle className="size-[18px]" strokeWidth={2} />
        {t('team.sendWhatsApp')}
      </Button>

      <button
        type="button"
        onClick={copyAll}
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong text-sm font-semibold text-ink"
      >
        {copiedAll ? <Check className="size-4" strokeWidth={2.2} /> : <Copy className="size-4" strokeWidth={2} />}
        {t('team.copyAll')}
      </button>

      <p className="rounded-2xl bg-warning-bg px-3.5 py-3 text-[13px] font-semibold text-warning">
        {t('team.credentialsWarning')}
      </p>

      <Button type="button" variant="secondary" className="h-[50px] w-full" onClick={onDone}>
        {t('team.done')}
      </Button>
    </div>
  )
}

export { CredentialsScreen }
export type { CredentialsScreenProps }
