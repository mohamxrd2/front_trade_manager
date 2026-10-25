import { describe, expect, test } from 'vitest'
import { translate, translations } from './translate'

describe('translate', () => {
  test('clé existante en anglais : renvoie la traduction anglaise', () => {
    expect(translate('common.save', 'en')).toBe('Save')
  })

  test('clé absente des deux langues : renvoie la clé brute (seul cas, filet de sécurité)', () => {
    expect(translate('this.key.does.not.exist.anywhere', 'en')).toBe('this.key.does.not.exist.anywhere')
  })

  test('clé présente en fr mais absente en en : affiche le texte français, jamais la clé brute', () => {
    // Reproduit le bug réel du lot 1 (collaborators.deleteConfirmTitle
    // manquait côté anglais avant correction) en retirant temporairement la
    // clé anglaise de l'objet de traductions chargé en mémoire.
    const enCollaborators = translations.en.collaborators as Record<string, unknown>
    const backup = enCollaborators.deleteConfirmTitle
    delete enCollaborators.deleteConfirmTitle

    try {
      const result = translate('collaborators.deleteConfirmTitle', 'en')
      expect(result).toBe('Supprimer le collaborateur ?')
      expect(result).not.toBe('collaborators.deleteConfirmTitle')
    } finally {
      enCollaborators.deleteConfirmTitle = backup
    }
  })

  test('interpolation {{param}} fonctionne après un repli français', () => {
    const enValidation = (translations.en.collaborators as Record<string, unknown>).validation as Record<string, unknown>
    const backup = enValidation.shareExceeds
    delete enValidation.shareExceeds

    try {
      const result = translate('collaborators.validation.shareExceeds', 'en', { share: 42 })
      expect(result).toBe('La part ne peut pas dépasser 42% (part disponible)')
    } finally {
      enValidation.shareExceeds = backup
    }
  })

  test('pluriel ICU : branche "one" en français', () => {
    expect(translate('dashboard.alertCount', 'fr', { count: 1 })).toBe('1 alerte')
  })

  test('pluriel ICU : branche "other" en anglais', () => {
    expect(translate('dashboard.alertCount', 'en', { count: 3 })).toBe('3 alerts')
  })
})
