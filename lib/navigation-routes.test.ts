import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import type { User } from '@/lib/auth'
import { getTabs, TABS } from '@/lib/tabs'
import { ACCOUNT_ITEMS, ACTIVITY_ITEMS } from '@/components/waelly/glass-sidebar'

/**
 * Chaque lien de navigation (barre du bas mobile ET menu latéral) doit
 * mener à une vraie page — l'onglet « Mes ventes » du caissier pointait
 * vers /my-sales sans page derrière (404).
 */
const APP_DIR = path.resolve(__dirname, '..', 'app')

function collectRoutes(dir: string, segments: string[] = []): string[] {
  const routes: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Groupes de routes "(dashboard)" : n'apparaissent pas dans l'URL.
      const next = /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name]
      routes.push(...collectRoutes(path.join(dir, entry.name), next))
    } else if (entry.name === 'page.tsx') {
      routes.push(`/${segments.join('/')}`)
    }
  }
  return routes
}

const ROUTES = new Set(collectRoutes(APP_DIR))

const ALL_PERMISSIONS = [
  'sales.create', 'sales.view_own', 'sales.view_all', 'stock.view', 'wallet.view_balance',
  'invoices.view', 'clients.view', 'analytics.view', 'team.manage',
]

function makeUser(overrides: Partial<User>): User {
  return { id: 'u1', first_name: 'K', last_name: 'Y', email: null, is_owner: false, role: null, permissions: [], ...overrides } as User
}

const USERS: User[] = [
  makeUser({ is_owner: true, role: 'owner', permissions: ALL_PERMISSIONS }),
  makeUser({ role: 'cashier', permissions: ['sales.create', 'sales.view_own', 'stock.view', 'clients.view'] }),
  makeUser({ role: 'stock_manager', permissions: ['stock.view', 'stock.edit', 'stock.restock'] }),
  makeUser({ role: 'accountant', permissions: ['wallet.view_balance', 'analytics.view', 'invoices.view', 'sales.view_all'] }),
]

describe('navigation → pages existantes', () => {
  const hrefs = new Set<string>([
    ...TABS.map((tab) => tab.href),
    ...USERS.flatMap((user) => getTabs(user).map((tab) => tab.href)),
    ...ACTIVITY_ITEMS.map((item) => item.href),
    ...ACCOUNT_ITEMS.map((item) => item.href),
  ])

  test.each([...hrefs])('%s a une page', (href) => {
    expect(ROUTES.has(href.split('?')[0])).toBe(true)
  })
})
