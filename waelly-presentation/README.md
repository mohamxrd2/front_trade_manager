# Waelly : page de présentation (ordinateur + mobile)

Une seule page **responsive** : la même maquette s'adapte à l'ordinateur et au téléphone.

## Contenu
- `apercu-navigateur.html` : ouvre-le dans Chrome. Réduis la fenêtre (ou ouvre les outils de développement, mode téléphone 390px) pour voir la version mobile. Les animations d'apparition au défilement fonctionnent ; les boutons interactifs (Mensuel / Annuel, FAQ, onglets) ne sont actifs que dans la maquette en ligne.
- `maquette/Presentation.dc.html` : le fichier source de la maquette, pour Claude Code.
- `apercus/ordinateur-1440.png` : la page complète en 1440px.
- `apercus/mobile-390.png` : la page complète en 390px.
- `apercus/mobile-390-planche.png` : la version mobile découpée en colonnes, plus facile à lire.

## Points de rupture
- **≤ 760px** : les liens du menu sont masqués et le visuel du héros est réduit à 62 %.
- **≤ 520px** : le bouton flèche est masqué et le visuel du héros est réduit à 38 %.
- **Partout ailleurs** : les grilles passent seules en une colonne (flex-wrap / auto-fit) et les titres utilisent clamp().

## Sections
1. Navigation : elle devient une pilule en verre au défilement.
2. Héros : titre animé, téléphone et carte facture, bulles flottantes.
3. Chiffres produit, puis la carte « Objectif du mois ».
4. Fonctionnalités : mini-graphiques ventes, analyses et stock.
5. « Encaissez une vente en trois gestes » avec un téléphone.
6. Pays d'Afrique francophone, avec une recherche.
7. Carte en pointillés et arcs animés, « De Dakar à Douala ».
8. Tarifs avec bascule Mensuel / Annuel. Les prix sont à remplacer : `[PRIX]`.
9. FAQ avec onglets et accordéon.
10. Bandeau d'appel à l'action, puis le pied de page navy.

## À compléter avant la mise en ligne
- Prix (`[PRIX]`), mentions légales, confidentialité, contact.
- Aucun chiffre inventé : si tu ajoutes des statistiques (nombre de boutiques, ventes), utilise de vrais chiffres.
