'use client'

import * as React from 'react'
import { Calculator, ChevronDown, Package, ShieldCheck, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { cn } from '@/lib/utils'
import type { RoleDefinition, PermissionOverride } from '@/lib/services/team'
import {
  ASSIGNABLE_ROLES,
  PERMISSION_CATALOG,
  PERMISSION_GROUP_LABEL_KEYS,
  PERMISSION_GROUP_ORDER,
  ROLE_CARDS,
  type AssignableRole,
} from '@/lib/permissions/catalog'
import { effectivePermissionSet, toggleOverride } from '@/lib/permissions/apply-overrides'

const ROLE_ICONS: Record<AssignableRole, LucideIcon> = {
  manager: ShieldCheck,
  cashier: ShoppingCart,
  stock_manager: Package,
  accountant: Calculator,
}

/** Permissions à mettre en avant pour un rôle donné (section 3 du chantier "Équipe" — cas du caissier). */
const HIGHLIGHTED_PERMISSIONS_BY_ROLE: Partial<Record<AssignableRole, string[]>> = {
  cashier: ['expenses.create', 'sales.delete_own_recent'],
}

export interface RolePickerValue {
  role: AssignableRole
  overrides: PermissionOverride[]
}

interface RolePickerProps {
  roles: RoleDefinition[]
  value: RolePickerValue
  onChange: (value: RolePickerValue) => void
}

function RolePicker({ roles, value, onChange }: RolePickerProps) {
  const { t } = useTranslation()
  const [customizing, setCustomizing] = React.useState(false)
  const defaults = roles.find((r) => r.role === value.role)?.permissions ?? []
  const effective = effectivePermissionSet(defaults, value.overrides)
  const highlighted = new Set(HIGHLIGHTED_PERMISSIONS_BY_ROLE[value.role] ?? [])

  const selectRole = (role: AssignableRole) => {
    if (role === value.role) return
    onChange({ role, overrides: [] })
  }

  const togglePermission = (permission: string, checked: boolean) => {
    onChange({ role: value.role, overrides: toggleOverride(permission, checked, defaults, value.overrides) })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        {ASSIGNABLE_ROLES.map((role) => {
          const card = ROLE_CARDS.find((c) => c.role === role)
          const Icon = ROLE_ICONS[role]
          const active = role === value.role
          return (
            <button
              key={role}
              type="button"
              onClick={() => selectRole(role)}
              aria-pressed={active}
              className={cn(
                'flex items-start gap-3 rounded-[18px] border p-3.5 text-left transition-colors',
                active ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-line-strong bg-surface'
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-soft text-ink-2'
                )}
              >
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-ink">{t(card!.nameKey)}</span>
                <span className="text-[13px] text-subtle">{t(card!.phraseKey)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setCustomizing((v) => !v)}
        className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand-600"
      >
        {t('team.customizePermissions')}
        <ChevronDown className={cn('size-4 transition-transform', customizing && 'rotate-180')} strokeWidth={2} />
      </button>

      {customizing ? (
        <div className="flex flex-col gap-4 rounded-[18px] border border-line-strong bg-surface p-3.5">
          {PERMISSION_GROUP_ORDER.map((group) => {
            const defs = PERMISSION_CATALOG.filter((p) => p.group === group)
            return (
              <div key={group} className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-subtle">
                  {t(PERMISSION_GROUP_LABEL_KEYS[group])}
                </span>
                {defs.map((def) => {
                  const checked = effective.has(def.key)
                  const isHighlighted = highlighted.has(def.key)
                  return (
                    <label
                      key={def.key}
                      className={cn(
                        'flex items-start gap-3 rounded-xl p-2 -mx-2',
                        isHighlighted && 'bg-brand-50 dark:bg-brand-500/10'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => togglePermission(def.key, e.target.checked)}
                        className="mt-0.5 size-[18px] shrink-0 accent-brand-600"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className={cn('text-[13px] font-semibold text-ink', isHighlighted && 'text-brand-700')}>
                          {t(def.labelKey)}
                        </span>
                        <span className="text-xs text-subtle">{t(def.descriptionKey)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export { RolePicker }
export type { RolePickerProps }
