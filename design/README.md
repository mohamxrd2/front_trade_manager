# Waelly — dossier design pour Claude Code

## Contenu

```
design/
├── README.md            ← ce fichier (mode d'emploi + prompts)
├── DESIGN.md            ← tout le système de design (couleurs, police, verre, composants, graphiques)
├── tailwind.config.ts   ← thème prêt pour Tailwind v3
├── waelly-theme.css     ← même thème pour Tailwind v4 (@theme) + variables CSS (Radix/shadcn)
└── maquettes/
    ├── mobile/          ← 14 écrans téléphone (390×844)
    └── ordinateur/      ← 18 écrans + le menu latéral (WebSidebar)
```

## Installation

1. Copier ce dossier à la racine du dépôt **front_trade_manager** sous le nom `design/`.
2. Vérifier la version de Tailwind dans `package.json` :
   - **v4** (`"tailwindcss": "^4…"`) → dans `app/globals.css`, ajouter `@import "../design/waelly-theme.css";` (adapter le chemin) après `@import "tailwindcss";`.
   - **v3** → fusionner `design/tailwind.config.ts` avec le `tailwind.config` existant.
3. Charger la police dans `app/layout.tsx` avec `next/font/google` (`Plus_Jakarta_Sans`, variable `--font-jakarta`).

(Claude Code peut faire ces trois étapes lui-même : voir le prompt 1.)

## Prompts à donner à Claude Code, dans l'ordre

**Prompt 1 — fondations**
```
Lis design/README.md et design/DESIGN.md.
Installe le thème Waelly : vérifie la version de Tailwind et applique soit design/waelly-theme.css (v4), soit design/tailwind.config.ts (v3).
Charge Plus Jakarta Sans via next/font (variable --font-jakarta).
Ne modifie aucune page pour l'instant. Montre-moi le diff.
```

**Prompt 2 — composants communs**
```
En suivant design/DESIGN.md (§ 6 à 9), crée ou mets à jour les composants communs :
Button (principal, noir, secondaire, danger, rond +), Card, HeroCard, KpiCard, StatusBadge, FilterChips, SegmentedControl,
TransactionRow, GlassBottomNav (mobile, icône + libellé), GlassSidebar (ordinateur, d'après design/maquettes/ordinateur/WebSidebar.dc.html),
AreaTrendChart (Recharts, § 9) et CategoryDonut.
Ne touche pas encore aux pages. Montre-moi une page de démonstration temporaire avec tous les composants.
```

**Prompt 3 — mise en page**
```
Mets en place la mise en page de l'app : GlassBottomNav sous 768 px, GlassSidebar au-dessus de 1024 px, fond bg-desktop sur ordinateur.
Respecte design/DESIGN.md § 8. Ne change pas le routage ni la logique d'authentification.
```

**Prompt 4 — écrans, un par un** (répéter pour chaque ligne du tableau de DESIGN.md § 10)
```
Refais l'écran <dashboard> en suivant design/maquettes/ordinateur/Web-Tableau.dc.html (ordinateur)
et design/maquettes/mobile/Main.dc.html (mobile).
Reprends les valeurs exactes des styles inline. Garde toute la logique existante (react-query, zod, appels API) :
ne change que le rendu. Remplace les données d'exemple des maquettes par les vraies données.
```

Ordre conseillé : dashboard → stock (+ ajout d'article, détail article) → wallet (+ nouvelle vente) → invoices (+ nouvelle facture, clients) → analytics → notifications → collaborateurs → settings → login / register / verify / onboarding → page de présentation.

## Conseils

- Valider chaque étape avant la suivante : c'est la meilleure façon d'éviter que le design dérive.
- Si quelque chose ne ressemble pas à la maquette, donner à Claude Code le nom du fichier et l'élément précis (« la barre du bas de Main.dc.html »).
- Les maquettes contiennent des données fictives (Awa Couture, montants, clients) : elles ne doivent pas se retrouver dans l'app.
- Le thème sombre n'est pas encore dessiné (DESIGN.md § 11).
