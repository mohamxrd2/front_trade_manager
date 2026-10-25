#!/usr/bin/env node
/**
 * Garde-fou i18n (npm run i18n:check). Deux familles de vérifications :
 *
 *  1. Clés manquantes entre messages/fr/*.json et messages/en/*.json, par
 *     domaine (fichier).
 *  2. Texte français codé en dur, détecté via un vrai parsing TypeScript/JSX
 *     (pas une regex ligne par ligne) :
 *     - texte JSX (JsxText) ;
 *     - attributs placeholder / title / aria-label / alt ;
 *     - arguments de toast(...)/toast.success/.error/.info/.warning/.loading ;
 *     - messages d'erreur Zod (.min/.max/.email/.regex/.refine/… avec un
 *       message littéral) ;
 *     - tableaux de constantes (options de select, statuts, rôles…) :
 *       tableaux de chaînes, ou tableaux d'objets avec une propriété
 *       label/title/message ;
 *     - formatage de date/nombre fait à la main (Intl.NumberFormat,
 *       Intl.DateTimeFormat, Intl.RelativeTimeFormat, dayjs.locale(...))
 *       en dehors de lib/i18n/format.ts — signalé indépendamment de la
 *       langue, c'est une violation structurelle (lib/i18n/format.ts doit
 *       être le seul point de formatage).
 *
 * Les fichiers listés dans scripts/i18n-check.ignore.json ne sont PAS
 * scannés pour (2) — on les retire au fur et à mesure qu'ils sont migrés
 * (lot par lot). La parité des clés (1), elle, s'applique TOUJOURS, sur
 * tout le projet.
 *
 * Suppression ciblée, ligne par ligne : commentaire `i18n:allow` (voir
 * CLAUDE.md) pour une exception assumée (nom de langue affiché dans sa
 * propre langue, donnée métier stockée en base, sentinelle interne).
 *
 * Échoue (code de sortie 1) si la moindre clé manque ou si du texte
 * français en dur est détecté sur un fichier non ignoré.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = path.join(ROOT, 'messages')
const IGNORE_FILE = path.join(ROOT, 'scripts', 'i18n-check.ignore.json')
const SCAN_DIRS = ['app', 'components', 'lib']
const FORMAT_HELPER_FILE = 'lib/i18n/format.ts'
const INLINE_ALLOW_MARKER = 'i18n:allow'

// ============================================================================
// 1. Clés fr/en manquantes, par domaine
// ============================================================================

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = v
    }
  }
  return out
}

function loadDomainKeys(lang) {
  const dir = path.join(MESSAGES_DIR, lang)
  const domains = {}
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const domain = file.replace(/\.json$/, '')
    const content = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'))
    domains[domain] = new Set(Object.keys(flatten(content)))
  }
  return domains
}

function checkKeyParity() {
  const fr = loadDomainKeys('fr')
  const en = loadDomainKeys('en')
  const allDomains = new Set([...Object.keys(fr), ...Object.keys(en)])
  const problems = []

  for (const domain of allDomains) {
    const frKeys = fr[domain] ?? new Set()
    const enKeys = en[domain] ?? new Set()

    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k))
    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k))

    if (missingInEn.length > 0) {
      problems.push(`  ✗ messages/en/${domain}.json : clé(s) manquante(s) — ${missingInEn.map((k) => `${domain}.${k}`).join(', ')}`)
    }
    if (missingInFr.length > 0) {
      problems.push(`  ✗ messages/fr/${domain}.json : clé(s) manquante(s) — ${missingInFr.map((k) => `${domain}.${k}`).join(', ')}`)
    }
  }

  return problems
}

// ============================================================================
// 2. Texte français en dur — détection par parsing AST
// ============================================================================

const ACCENTS = /[àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ]/
const COMMON_FRENCH_WORDS = [
  'Annuler', 'Modifier', 'Ajouter', 'Supprimer', 'Enregistrer', 'Fermer',
  'Suivant', 'Precedent', 'Rechercher', 'Filtrer', 'Exporter', 'Importer',
  'Chargement', 'Reessayer', 'Confirmer', 'Selectionner', 'Retour',
  'Nouveau', 'Nouvelle', 'Toutes', 'Aucun', 'Aucune', 'Disponible',
  'Requis', 'Optionnel', 'Connecter', 'Dissocier', 'Voir',
]
const COMMON_WORDS_RE = new RegExp(`\\b(${COMMON_FRENCH_WORDS.join('|')})\\b`, 'i')

function looksFrench(text) {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  return ACCENTS.test(trimmed) || COMMON_WORDS_RE.test(trimmed)
}

const ZOD_MESSAGE_METHODS = new Set([
  'min', 'max', 'length', 'email', 'url', 'uuid', 'regex', 'refine',
  'superRefine', 'includes', 'startsWith', 'endsWith', 'nonempty', 'gte', 'lte',
])
const TOAST_METHODS = new Set(['success', 'error', 'info', 'warning', 'loading', 'message'])
const OPTION_LABEL_KEYS = new Set(['label', 'title', 'message', 'name'])

function listSourceFiles() {
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        walk(full)
      } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
        files.push(path.relative(ROOT, full))
      }
    }
  }
  for (const d of SCAN_DIRS) {
    const full = path.join(ROOT, d)
    if (existsSync(full)) walk(full)
  }
  return files
}

function loadIgnoreList() {
  if (!existsSync(IGNORE_FILE)) return new Set()
  return new Set(JSON.parse(readFileSync(IGNORE_FILE, 'utf-8')))
}

/** true si la ligne source contenant `pos` porte le marqueur de suppression. */
function lineHasAllowMarker(sourceFile, pos) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(pos)
  const lineText = sourceFile.text.split('\n')[line] ?? ''
  return lineText.includes(INLINE_ALLOW_MARKER)
}

function lineOf(sourceFile, pos) {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1
}

/** Valeur littérale d'une chaîne simple (StringLiteral ou NoSubstitutionTemplateLiteral), sinon null. */
function plainStringValue(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function scanFile(file, problems) {
  const text = readFileSync(path.join(ROOT, file), 'utf-8')
  const isFormatHelper = file === FORMAT_HELPER_FILE
  let sourceFile
  try {
    sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    return // fichier non parsable (ne devrait pas arriver sur du TS valide) — ignoré silencieusement
  }

  function report(pos, message) {
    if (lineHasAllowMarker(sourceFile, pos)) return
    problems.push(`  ✗ ${file}:${lineOf(sourceFile, pos)} — ${message}`)
  }

  function visit(node) {
    // --- JSX texte ---
    if (ts.isJsxText(node)) {
      if (looksFrench(node.text)) {
        report(node.getStart(sourceFile), `texte JSX : "${node.text.trim().slice(0, 80)}"`)
      }
    }

    // --- Attributs JSX (placeholder, title, aria-label, alt) ---
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile)
      if (['placeholder', 'title', 'aria-label', 'alt'].includes(attrName) && node.initializer) {
        let value = plainStringValue(node.initializer)
        if (!value && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          value = plainStringValue(node.initializer.expression)
        }
        if (value && looksFrench(value)) {
          report(node.getStart(sourceFile), `attribut ${attrName}="${value.slice(0, 80)}"`)
        }
      }
    }

    // --- Appels de fonction : toast(...), méthodes Zod, Intl.*, dayjs.locale ---
    if (ts.isCallExpression(node)) {
      const callee = node.expression

      // toast(...) / toast.success(...) / etc.
      let isToastCall = false
      if (ts.isIdentifier(callee) && callee.text === 'toast') isToastCall = true
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'toast' &&
        TOAST_METHODS.has(callee.name.text)
      ) {
        isToastCall = true
      }
      if (isToastCall) {
        for (const arg of node.arguments) {
          const value = plainStringValue(arg)
          if (value && looksFrench(value)) {
            report(arg.getStart(sourceFile), `toast(...) : "${value.slice(0, 80)}"`)
          }
          // { description: '...' } / { message: '...' } en 2e argument
          if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                const v = plainStringValue(prop.initializer)
                if (v && looksFrench(v)) {
                  report(prop.getStart(sourceFile), `toast(...) ${prop.name.text}: "${v.slice(0, 80)}"`)
                }
              }
            }
          }
        }
      }

      // Méthodes Zod avec message littéral (.min(1, 'texte'), .refine(fn, 'texte')…)
      if (ts.isPropertyAccessExpression(callee) && ZOD_MESSAGE_METHODS.has(callee.name.text)) {
        for (const arg of node.arguments) {
          const value = plainStringValue(arg)
          if (value && looksFrench(value)) {
            report(arg.getStart(sourceFile), `message Zod .${callee.name.text}(...) : "${value.slice(0, 80)}"`)
          }
          if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'message') {
                const v = plainStringValue(prop.initializer)
                if (v && looksFrench(v)) {
                  report(prop.getStart(sourceFile), `message Zod .${callee.name.text}({message: "${v.slice(0, 80)}"})`)
                }
              }
            }
          }
        }
      }

      // Intl.NumberFormat / Intl.DateTimeFormat / Intl.RelativeTimeFormat en dehors du helper
      if (
        !isFormatHelper &&
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Intl' &&
        ['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat'].includes(callee.name.text)
      ) {
        report(node.getStart(sourceFile), `Intl.${callee.name.text}(...) codé en dur — utiliser lib/i18n/format.ts`)
      }

      // dayjs.locale('fr') — réglage GLOBAL (singleton partagé par toute
      // l'app), distinct de dayjs(x).locale(lang) (par-appel, autorisé dans
      // lib/i18n/format.ts). Repéré ici par callee.expression étant
      // l'identifiant `dayjs` directement (pas un résultat d'appel dayjs()).
      if (
        !isFormatHelper &&
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'dayjs' &&
        callee.name.text === 'locale'
      ) {
        report(node.getStart(sourceFile), `dayjs.locale(...) global codé en dur — utiliser lib/i18n/format.ts`)
      }
    }

    // --- Tableaux de constantes (options, statuts, rôles…) ---
    if (ts.isArrayLiteralExpression(node)) {
      for (const el of node.elements) {
        const strValue = plainStringValue(el)
        if (strValue && looksFrench(strValue)) {
          report(el.getStart(sourceFile), `valeur de tableau : "${strValue.slice(0, 80)}"`)
          continue
        }
        if (ts.isObjectLiteralExpression(el)) {
          for (const prop of el.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && OPTION_LABEL_KEYS.has(prop.name.text)) {
              const v = plainStringValue(prop.initializer)
              if (v && looksFrench(v)) {
                report(prop.getStart(sourceFile), `${prop.name.text}: "${v.slice(0, 80)}" dans un tableau d'options`)
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function checkHardcodedFrench() {
  const ignore = loadIgnoreList()
  const problems = []

  for (const file of listSourceFiles()) {
    if (ignore.has(file)) continue
    scanFile(file, problems)
  }

  return problems
}

// ============================================================================
// Exécution
// ============================================================================

const keyProblems = checkKeyParity()
const textProblems = checkHardcodedFrench()

if (keyProblems.length > 0) {
  console.log('❌ Clés de traduction manquantes :\n')
  console.log(keyProblems.join('\n'))
  console.log('')
}

if (textProblems.length > 0) {
  console.log(`❌ Texte français en dur détecté (${textProblems.length} occurrence(s), hors fichiers ignorés) :\n`)
  console.log(textProblems.join('\n'))
  console.log('')
}

if (keyProblems.length === 0 && textProblems.length === 0) {
  console.log('✅ i18n:check — aucune clé manquante, aucun texte français en dur détecté (hors fichiers pas encore migrés).')
  process.exit(0)
} else {
  console.log(`i18n:check a échoué : ${keyProblems.length} clé(s) manquante(s), ${textProblems.length} occurrence(s) en dur.`)
  process.exit(1)
}
