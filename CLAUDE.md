# Règles du projet

## Internationalisation (fr/en)

Tout nouveau texte visible passe par une clé de traduction en fr ET en.

- Jamais de texte en dur dans un composant (JSX, `placeholder`, `aria-label`, titre de toast, message d'erreur…) — toujours `t('domaine.cle')`, défini dans `messages/fr/<domaine>.json` **et** `messages/en/<domaine>.json`.
- Dates, nombres et montants passent par `lib/i18n/format.ts` (`formatMoney`, `formatNumber`, `formatDate`, `formatDateTime`, `formatRelative`) — jamais un `Intl.NumberFormat('fr-FR', …)` ou un `dayjs.locale('fr')` codé en dur : `dayjs.locale()` est un réglage global qui écrase celui des autres composants.
- Pluriels : syntaxe ICU minimale `{count, plural, one {...} other {...}}` (voir `lib/i18n/icu-plural.ts`).
- Avant de committer un écran traduit, lance `npm run i18n:check` — il échoue s'il manque une clé entre fr/en ou s'il détecte du texte français en dur dans un fichier qui n'est plus dans `scripts/i18n-check.ignore.json`.
- Un fichier migré doit être retiré de `scripts/i18n-check.ignore.json` (c'est ce qui active la vérification dessus).
- Exception ciblée et assumée (nom de langue affiché dans sa propre langue, donnée métier stockée en base, sentinelle interne non affichée) : commentaire `// i18n:allow` sur la ligne concernée, avec la raison.
