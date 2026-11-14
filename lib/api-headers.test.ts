import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import { API_REQUEST_HEADERS } from './api-headers'

const ROOT = path.resolve(__dirname, '..')
const BACKEND_CORS = path.resolve(ROOT, '../../back-end-api/trade_manager_v2/config/cors.php')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

/** En-têtes posés dans le code : headers['X-…'] = …, et clés des objets headers: { … }. */
function headersSetInCode(): Map<string, string> {
  const found = new Map<string, string>()
  for (const dir of ['lib', 'app', 'components', 'contexts', 'hooks']) {
    const full = path.join(ROOT, dir)
    if (!existsSync(full)) continue
    for (const file of sourceFiles(full)) {
      const code = readFileSync(file, 'utf8')
      for (const m of code.matchAll(/headers\[['"]([A-Za-z-]+)['"]\]\s*=(?!=)/g)) found.set(m[1], file)
      for (const block of code.matchAll(/headers:\s*\{([^}]*)\}/g)) {
        for (const key of block[1].matchAll(/['"]?([A-Za-z][A-Za-z-]*)['"]?\s*:/g)) found.set(key[1], file)
      }
    }
  }
  return found
}

const declared = new Set(API_REQUEST_HEADERS.map((h) => h.toLowerCase()))

describe('en-têtes envoyés à l’API', () => {
  test('chaque en-tête posé dans le code est déclaré dans lib/api-headers.ts', () => {
    const missing = [...headersSetInCode()].filter(([header]) => !declared.has(header.toLowerCase()))
    expect(missing.map(([h, file]) => `${h} (${path.relative(ROOT, file)})`)).toEqual([])
  })

  test.skipIf(!existsSync(BACKEND_CORS))('le backend les autorise tous (config/cors.php, allowed_headers)', () => {
    const php = readFileSync(BACKEND_CORS, 'utf8')
    const block = php.match(/'allowed_headers'\s*=>\s*\[([\s\S]*?)\]/)?.[1] ?? ''
    const allowed = new Set([...block.matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1].toLowerCase()))

    expect(API_REQUEST_HEADERS.filter((h) => !allowed.has(h.toLowerCase()))).toEqual([])
  })
})
