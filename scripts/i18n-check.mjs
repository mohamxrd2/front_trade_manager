#!/usr/bin/env node
/**
 * Garde-fou i18n (npm run i18n:check) :
 *  1. Clés présentes dans messages/fr/*.json mais absentes de messages/en/*.json,
 *     et l'inverse — par domaine (fichier).
 *  2. Texte français codé en dur restant dans les composants (détection
 *     simple : accents + liste de mots français courants), sur les fichiers
 *     PAS listés dans scripts/i18n-check.ignore.json (lot par lot : un
 *     fichier migré est retiré de cette liste, voir CLAUDE.md).
 *
 * Échoue (code de sortie 1) si la moindre clé manque ou si du texte français
 * en dur est détecté sur un fichier non ignoré.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = path.join(ROOT, 'messages')
const IGNORE_FILE = path.join(ROOT, 'scripts', 'i18n-check.ignore.json')
const SCAN_DIRS = ['app', 'components']

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
// 2. Texte français en dur restant (détection simple)
// ============================================================================

const ACCENTS = /[àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ]/
// Mots français courants sans accent, repérés dans l'app au fil des lots —
// liste volontairement non exhaustive (détection "simple", pas un vrai
// analyseur linguistique).
const COMMON_FRENCH_WORDS = [
  'Annuler', 'Modifier', 'Ajouter', 'Supprimer', 'Enregistrer', 'Fermer',
  'Suivant', 'Precedent', 'Rechercher', 'Filtrer', 'Exporter', 'Importer',
  'Chargement', 'Reessayer', 'Confirmer', 'Selectionner', 'Retour',
  'Nouveau', 'Nouvelle', 'Toutes', 'Aucun', 'Aucune', 'Disponible',
  'Requis', 'Optionnel', 'Connecter', 'Dissocier', 'Voir',
]
const COMMON_WORDS_RE = new RegExp(`\\b(${COMMON_FRENCH_WORDS.join('|')})\\b`)

function listTsxFiles() {
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
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

/**
 * Exception explicite et ciblée (ligne par ligne) — ex. nom de langue qui
 * doit s'afficher dans sa propre langue ("Français"/"English", jamais
 * traduit), valeur métier stockée en base, sentinelle interne non visible.
 * Préférer une vraie clé de traduction dès que possible ; `i18n:allow` reste
 * une échappatoire assumée et visible dans le diff, pas un silence discret.
 */
const INLINE_ALLOW_MARKER = 'i18n:allow'

function checkHardcodedFrench() {
  const ignore = loadIgnoreList()
  const problems = []

  for (const file of listTsxFiles()) {
    if (ignore.has(file)) continue

    const lines = readFileSync(path.join(ROOT, file), 'utf-8').split('\n')
    let inBlockComment = false

    lines.forEach((line, i) => {
      const stripped = line.trim()

      if (inBlockComment) {
        if (stripped.includes('*/')) inBlockComment = false
        return
      }

      if (stripped.startsWith('//')) return
      if (stripped.includes(INLINE_ALLOW_MARKER)) return

      // Commentaire bloc (y compris JSX `{/* ... */}`) : s'il ne se referme
      // pas sur la même ligne, on ignore aussi toutes les lignes suivantes
      // jusqu'à la fermeture.
      const opensBlockComment = /\{?\/\*/.test(stripped)
      const closesOnSameLine = stripped.includes('*/')
      if (opensBlockComment) {
        if (!closesOnSameLine) inBlockComment = true
        return
      }

      // Retire un commentaire de fin de ligne ("code, // note en français")
      // avant de tester — ne coupe que si rien après // ne ressemble à une
      // chaîne encore ouverte (pas de guillemet), pour éviter de tronquer un
      // vrai littéral contenant "//" (ex. une URL).
      const trailingCommentMatch = stripped.match(/\/\/[^'"]*$/)
      const codePart = trailingCommentMatch ? stripped.slice(0, trailingCommentMatch.index).trimEnd() : stripped

      if (ACCENTS.test(codePart) || COMMON_WORDS_RE.test(codePart)) {
        problems.push(`  ✗ ${file}:${i + 1} — ${stripped.slice(0, 100)}`)
      }
    })
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
  console.log(`❌ Texte français en dur détecté (${textProblems.length} ligne(s), hors fichiers ignorés) :\n`)
  console.log(textProblems.join('\n'))
  console.log('')
}

if (keyProblems.length === 0 && textProblems.length === 0) {
  console.log('✅ i18n:check — aucune clé manquante, aucun texte français en dur détecté (hors fichiers pas encore migrés).')
  process.exit(0)
} else {
  console.log(`i18n:check a échoué : ${keyProblems.length} clé(s) manquante(s), ${textProblems.length} ligne(s) en dur.`)
  process.exit(1)
}
