# Waelly — Système de design « Indigo & Liquid Glass »

Ce document décrit **tout** le design de Waelly. Il fait foi : en cas de doute, les valeurs exactes sont dans les maquettes (`maquettes/`), écrites en styles inline.

- Stack cible : Next.js 16, React 19, Tailwind, Radix UI, Recharts, next-themes, Lucide.
- Langue de l'interface : français. Devise par défaut : FCFA (format `1 245 000`, espace comme séparateur de milliers).
- Le thème sombre n'a **pas encore été maquetté** (voir § 11).

---

## 1. Principes

1. **Fond clair, cartes blanches, une seule couleur forte** : le violet `#5B3FE6`. Le bleu nuit est réservé aux cartes « héros » (solde, total, mise en avant).
2. **Liquid glass** uniquement pour la navigation (barre mobile flottante, menu latéral ordinateur, barres d'onglets) et les panneaux latéraux (aperçu facture, panier, fiche client). Jamais pour le contenu principal.
3. **Tout est arrondi** : pilules pour les boutons et filtres, 22–28 px pour les cartes.
4. **Vert = argent qui entre, rouge = argent qui sort.** Jamais de vert/rouge pour autre chose.
5. Cibles tactiles ≥ 44 px. Contraste texte ≥ 4.5:1.

## 2. Couleurs

### Neutres
| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#F3F3F7` | Fond des écrans mobiles |
| `canvas-desktop` | `#F1F2F7` | Fond ordinateur (avec halos, § 8) |
| `surface` | `#FFFFFF` | Cartes, champs |
| `surface-soft` | `#F6F5FB` | Cartes secondaires, encarts |
| `ink` | `#0E0E1A` | Texte principal, boutons noirs, filtre actif |
| `ink-2` | `#3F3F50` | Texte secondaire fort, onglets inactifs |
| `ink-3` | `#4B4B5C` | Texte tertiaire |
| `subtle` | `#6B6B7B` | Légendes, labels, dates — classe `text-subtle` (⚠ pas `text-muted`, qui vaut le fond `#F3F3F7` chez shadcn) |
| `line` | `#ECECF2` | Bordures de cartes |
| `line-strong` | `#E2E2EA` | Bordures de champs, boutons secondaires |
| `divider` | `#F0F0F4` | Séparateurs de lignes de tableau/liste |

### Violet (marque)
| Token | Hex | Usage |
|---|---|---|
| `brand-50` | `#F4F1FF` | Ligne sélectionnée, encart d'info |
| `brand-100` | `#EEEAFE` | Fond d'icône, badge |
| `brand-200` | `#C9BDFB` | Bordure sélection, période précédente (graph) |
| `brand-300` | `#A58CFF` | Série secondaire |
| `brand-400` | `#6A4CF0` | Remplissage du graphique |
| `brand-500` | `#5B3FE6` | **Couleur principale** (ligne de graph, liens, sélection) |
| `brand-600` | `#4B2FD6` | Icônes, liens |
| `brand-700` | `#3A20B8` | Texte actif, hover |
| `brand-glow` | `#8C74FF` | Début du dégradé des boutons |
| `brand-deep` | `#3420B8` | Fin du dégradé des boutons |

### Bleu nuit (cartes héros)
`#3A3AF0` → `#1717A0` → `#0A0A4A` → `#06062A`. Texte dessus : `#FFFFFF`, secondaire `#C8C8F0`, tertiaire `#DCDCF7`.

### Sémantique
| Rôle | Texte | Fond | Point |
|---|---|---|---|
| Succès / entrée / payée | `#0B8A43` (montants) · `#0B6B39` (sur fond) | `#E3F5EA` | — |
| Danger / sortie / stock faible | `#D92D20` (montants) · `#A3213A` (sur fond) | `#FDE8EC` | `#E5484D` |
| Attention / envoyée | `#8A4B00` | `#FFF0E0` | — |
| Info / équipe | `#1F3FB8` | `#E6EEFF` | — |
| Brouillon / neutre | `#3F3F50` | `#EDEDF2` | — |

### Couleurs d'avatars / vignettes (cycle de 5)
`#EEEAFE/#4B2FD6`, `#E6EEFF/#1F3FB8`, `#FFF0E0/#8A4B00`, `#E8F6EE/#0B6B39`, `#FDE8EC/#A3213A` (fond/texte). Initiales en gras 700.

### Graphiques
- Série principale : `#5B3FE6`. Remplissage : dégradé vertical `#6A4CF0` 30 % → 0 %.
- Anneau des catégories : `#2A1A9E`, `#6A4CF0`, `#A58CFF`, `#DCD4FF` (la dernière avec un liseré `#B9ACF5`).
- Grille : `#ECECF2`, pointillés `3 4`.

## 3. Dégradés (à copier tels quels)

```css
--gradient-hero:   radial-gradient(120% 90% at 100% 100%, #3A3AF0 0%, #1717A0 35%, #0A0A4A 70%, #06062A 100%);
--gradient-button: radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%);
--gradient-orb:    radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8);   /* logo, bouton rond +, avatar sélectionné */
--gradient-violet: linear-gradient(160deg, #5B3FE6 0%, #7A5CF5 55%, #C8B8FF 100%); /* en-têtes violets (Factures mobile, Inscription) */
```

## 4. Typographie

- Police unique : **Plus Jakarta Sans** (400, 500, 600, 700, 800) via `next/font/google`.
- Repli : `'Helvetica Neue', sans-serif`.

| Rôle | Taille | Graisse | Interlettrage |
|---|---|---|---|
| Titre landing (h1) | `clamp(40px, 5vw, 64px)` | 800 | -0.035em |
| Titre de section landing | `clamp(30px, 3.4vw, 44px)` | 800 | -0.03em |
| Titre de page app | 28 px | 700 | -0.02em |
| Montant héros | 38 px (mobile) · 46 px (ordinateur) | 700 | -0.03em |
| KPI | 26–30 px | 700 | -0.02em |
| Titre de carte (h2) | 16–18 px | 700 | — |
| Corps | 14–15 px | 400–600 | — |
| Label de champ | 13 px | 600 | — |
| Légende / date | 12–13 px | 400–600 | — |
| Libellé de navigation mobile | 11 px | 600 (actif 700) | -0.01em |
| En-tête de tableau | 12 px, MAJUSCULES | 600 | 0.05em |

## 5. Espacements, rayons, ombres

- Grille de base 4 px. Padding page : 20 px. Espace entre sections : 18–20 px. Entre cartes : 10–14 px. Padding carte : 18–22 px.
- **Rayons** : champ 14 px · petite carte 16–18 px · carte 22 px · grande carte 26 px · héros 28–32 px · navigation 36 px · bouton/filtre/badge : pilule (`9999px`).
- **Ombres** :
  - carte : `0 4px 18px rgba(17,17,80,0.05)`
  - héros : `0 18px 40px rgba(16,16,120,0.28)`
  - bouton principal : `0 8px 20px rgba(75,47,214,0.35)`
  - flottant (glass) : `0 14px 34px rgba(17,17,80,0.18), 0 2px 6px rgba(17,17,80,0.08)`

## 6. Liquid glass (la recette)

```css
.glass {
  background: linear-gradient(180deg, rgba(255,255,255,0.66), rgba(255,255,255,0.36));
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.8);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.95),   /* reflet en haut */
    inset 0 -1px 1px rgba(255,255,255,0.35),  /* reflet en bas */
    0 14px 34px rgba(17,17,80,0.18),
    0 2px 6px rgba(17,17,80,0.08);
}
.glass-active {          /* onglet / élément actif dans du verre */
  color: #3A20B8; font-weight: 700;
  background: linear-gradient(180deg, rgba(106,76,240,0.20), rgba(106,76,240,0.08));
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.9), inset 0 0 0 1px rgba(106,76,240,0.16);
}
```
Variante « panneau » (menu latéral, aperçu) : dégradé `0.72 → 0.44` et `blur(24px)`.
Le verre n'est beau que s'il y a du contenu ou des halos colorés derrière : ne jamais le poser sur un fond uni.

## 7. Composants

### Boutons
| Variante | Style |
|---|---|
| Principal | pilule, `--gradient-button`, texte blanc 700, ombre bouton. Hauteur 48 (ordinateur) / 54 (mobile) |
| Noir | pilule, fond `#0E0E1A`, texte blanc 700 |
| Secondaire | pilule, fond blanc, bordure `#E2E2EA`, texte `#0E0E1A` 600–700 |
| Sur verre | fond `rgba(255,255,255,0.8)`, bordure `rgba(255,255,255,0.95)` |
| Danger | fond `#FDE8EC`, texte `#A3213A` ; ou bordure `#F3C7CF` sur blanc |
| Rond « + » | 48–58 px, `--gradient-orb`, icône blanche |

### Filtres (chips) et contrôles segmentés
- **Chips** : pilule 40 px. Actif = fond `#0E0E1A` + texte blanc. Inactif = blanc + bordure `#E2E2EA` + texte `#3F3F50`.
- **Segmenté** : conteneur `#F3F3F7` (ou verre), padding 4 px. Option active = pilule blanche + ombre `0 2px 6px rgba(17,17,80,0.1)`.

### Champs
Hauteur 48–52 px, rayon 14 px, bordure `#E2E2EA`, fond blanc, texte 15–16 px. Label au-dessus (13 px, 600). Focus : bordure 2 px `#5B3FE6`. Recherche : pilule, fond `#F3F3F7`, icône loupe à gauche.

### Cartes
- Standard : blanc, rayon 22–26 px, ombre carte (ou bordure `#ECECF2` sur mobile).
- Héros : `--gradient-hero`, texte blanc, sous-cartes `rgba(255,255,255,0.1)` + bordure `rgba(255,255,255,0.16)`.
- KPI : label 13 px `#6B6B7B`, valeur 26–30 px 700, variation 13 px 700 en vert/rouge avec flèche ↑/↓.

### Badges de statut (pilule 12 px, 700)
Payée `#E3F5EA/#0B6B39` · Envoyée `#FFF0E0/#8A4B00` · Brouillon `#EDEDF2/#3F3F50` · Stock faible `#FDE8EC/#A3213A` · Disponible `#E3F5EA/#0B6B39`.

### Lignes de transaction
Icône ronde 36–46 px (vente : `#E3F5EA` + « + » vert ; dépense : `#FDE8EC` + « − » rouge), titre 14–15 px 600, méta 12–13 px `#6B6B7B`, montant à droite 700 en vert/rouge.

### Tableaux (ordinateur)
En-têtes 12 px majuscules `#6B6B7B`, lignes séparées par `#F0F0F4`, ligne sélectionnée `#F4F1FF`, toujours dans un conteneur `overflow-x: auto`.

### Interrupteur
52×32, rayon 16, actif `#5B3FE6`, inactif `#C9C9D6`, pastille blanche 26 px.

### Icônes
Lucide (déjà dans le projet), trait 1.8 (2 si actif), 18–22 px. Pas d'emoji.

## 8. Mises en page

### Mobile (≤ 768 px) — maquettes `maquettes/mobile/`
- Contenu en une colonne, padding 20 px, `padding-bottom: 112px` pour laisser la place à la barre.
- **Barre de navigation flottante en verre** : `position: fixed; left: 14px; right: 14px; bottom: 22px; height: 72px; border-radius: 36px; padding: 6px`. 5 onglets : Accueil, Stock, Portefeuille, Factures, Analyses — **icône au-dessus du libellé**. Onglet actif = `.glass-active`.
- Pas de fausse barre d'état ni de faux clavier.

### Ordinateur (≥ 1024 px) — maquettes `maquettes/ordinateur/`
- Fond `#F1F2F7` + 3 halos :
  `radial-gradient(700px 480px at 0% 0%, rgba(106,76,240,0.22), transparent 70%), radial-gradient(800px 560px at 100% 10%, rgba(58,58,240,0.14), transparent 70%)`.
- Conteneur `max-width: 1480px`, padding 20 px, `flex-wrap` : **menu latéral en verre** (`flex: 1 1 240px`) + contenu (`flex: 999 1 560px`). Sous ~840 px le menu passe au-dessus.
- Menu latéral (`WebSidebar.dc.html`) : logo, bouton « Nouvelle vente », groupes « Activité » (Tableau de bord, Stock, Portefeuille, Factures, Clients, Analyses) et « Compte » (Collaborateurs, Notifications, Paramètres), carte utilisateur + déconnexion.
- En-tête de page : titre 28 px + sous-titre, actions à droite (boutons pilules).
- Grilles : `repeat(auto-fit, minmax(min(220px, 100%), 1fr))`.

## 9. Graphique de tendance (style « Monthly Trend »)

Recharts `AreaChart` :
- `type="monotone"`, `stroke="#5B3FE6"`, `strokeWidth={3}`, `fill="url(#waellyArea)"` (dégradé `#6A4CF0` opacité 0.30 → 0).
- `CartesianGrid` horizontal seulement, `stroke="#ECECF2"`, `strokeDasharray="3 4"`, `vertical={false}`.
- Axes sans ligne ni tiret, texte 10–12 px `#6B6B7B` ; dernier libellé X en gras `#0E0E1A`. Axe Y abrégé (`300k`, `1,5M`).
- Point final : `activeDot`/`dot` uniquement sur le dernier point, rayon 6, remplissage blanc, contour 3 px `#5B3FE6`.
- Bulle de valeur : pilule blanche bordée `#E2E2EA` (mobile) ou noire `#0E0E1A` texte blanc (ordinateur), 11–12 px 700.
- Au-dessus du graphique : « ↑ 18 % » en vert 700 + texte explicatif, et un sélecteur de période.

Anneau des catégories : `PieChart` avec `innerRadius` ≈ 70 %, couleurs § 2, total au centre.

## 10. Écrans et correspondance

| Maquette mobile | Maquette ordinateur | Route probable |
|---|---|---|
| — | `Web-Accueil` (page de présentation) | `/` (public) |
| `Connexion` | `Web-Connexion` | `/login` |
| — | `Web-Inscription` | `/register` |
| `Verification` | `Web-Verification` | `/verify` |
| `Onboarding` | `Web-Onboarding` | `/onboarding` |
| `Main` (Accueil) | `Web-Tableau` | `/dashboard` |
| `Stock` | `Web-Stock` | `/products` |
| `AjoutArticle` | `Web-AjoutArticle` | `/products/new` |
| `Article` | `Web-Article` | `/products/[id]` |
| `Vente` | `Web-Vente` | `/wallet/new` |
| `Portefeuille` | `Web-Portefeuille` | `/wallet` |
| `Factures` | `Web-Factures` | `/invoices` |
| `NouvelleFacture` | `Web-NouvelleFacture` | `/invoices/new` |
| — | `Web-Clients` | `/invoices/clients` |
| `AjoutClient` | `Web-NouveauClient` (fenêtre modale) | `/clients/new` ou modale |
| `Collaborateurs` (via Paramètres) | `Web-Collaborateurs` | `/collaborators` |
| `Analyses` | `Web-Analyses` | `/analytics` |
| `Notifications` | `Web-Notifications` | `/notifications` |
| `Parametres` | `Web-Parametres` | `/settings` |

Adapter les routes aux vraies routes du projet.

**Accès mobile (pas d'onglet dans la barre du bas) :** sur l'Accueil, l'avatar et le bouton engrenage (à gauche de la cloche) ouvrent Paramètres. Dans Paramètres, la ligne « Collaborateurs » ouvre la page Collaborateurs, et la ligne « Notifications » ouvre Notifications.

## 11. Thème sombre (non maquetté)

`next-themes` est en place mais aucun écran sombre n'a été dessiné. Proposition de départ dans `waelly-theme.css` (`.dark`) : fond `#0B0B16`, cartes `#15152A`, texte `#F2F2F8`, verre `rgba(30,30,60,0.55)`. À valider visuellement avant de le livrer.

## 12. Lire les maquettes `.dc.html`

Ce sont des pages HTML avec un petit langage de gabarit :
- les styles sont **inline** : c'est la source des valeurs exactes ;
- `{{ valeur }}` = donnée calculée dans le `<script type="text/x-dc">` en bas du fichier (méthode `renderVals()`), qui contient aussi les données d'exemple et les comportements (filtres, sélection, calculs) ;
- `<sc-for list=…>` = boucle, `<sc-if value=…>` = condition, `<dc-import name="WebSidebar" active="stock">` = composant menu latéral ;
- `support.js` n'est pas fourni : les fichiers ne s'ouvrent pas tels quels dans un navigateur, ils servent de référence.

Les noms, montants et clients sont **fictifs**. Les vraies données viennent de l'API Laravel.
