# Trade Manager - Application de Gestion Commerciale et d'Inventaire

## 📋 Description Générale

**Trade Manager** est une application web moderne et complète de gestion commerciale et d'inventaire, conçue pour aider les commerçants et entrepreneurs à gérer efficacement leurs stocks, leurs transactions financières et leurs analyses de performance. L'application offre une interface intuitive et des outils puissants pour suivre les ventes, les dépenses, le stock et les performances commerciales en temps réel.

## 🎯 Objectifs Principaux

L'application permet de :
- **Gérer l'inventaire** : Suivre les produits, leurs quantités, leurs prix et leur statut de stock
- **Enregistrer les transactions** : Gérer les ventes et les dépenses avec un suivi détaillé
- **Analyser les performances** : Visualiser les tendances, les statistiques et les prédictions
- **Collaborer** : Gérer une équipe de collaborateurs avec répartition des revenus
- **Optimiser les décisions** : Utiliser des données analytiques pour améliorer la gestion

## 🚀 Fonctionnalités Principales

### 1. **Gestion des Produits**
- **Articles simples et variables** : Support pour produits avec ou sans variations (tailles, couleurs, etc.)
- **Suivi du stock** : Quantité totale, quantité vendue, quantité restante, pourcentage de vente
- **Alertes de stock faible** : Notifications automatiques lorsque le stock est critique
- **Valeur du stock** : Calcul automatique de la valeur totale de l'inventaire
- **Détails produits** : Pages détaillées avec historique des transactions et variations

### 2. **Gestion des Transactions**
- **Ventes** : Enregistrement des ventes avec sélection d'articles, quantités et prix
- **Dépenses** : Suivi des dépenses avec nom et montant
- **Historique complet** : Liste paginée de toutes les transactions avec recherche et filtres
- **Statistiques financières** : Solde actuel, total des ventes, total des dépenses, revenu personnel

### 3. **Analytics et Statistiques**
- **Vue d'ensemble** : Revenu net, total des ventes, total des dépenses avec comparaisons temporelles
- **Graphiques de tendances** : Évolution des ventes et dépenses dans le temps, évolution du portefeuille
- **Analyse par catégorie** : Répartition des ventes par type, top 5 des produits les plus vendus
- **Indicateurs clés (KPIs)** : Marge nette, panier moyen, ventes moyennes par jour, taux de dépenses
- **Prédictions de réapprovisionnement** : Calculs automatiques basés sur les ventes moyennes
- **Filtres temporels** : Aujourd'hui, 7 jours, 30 jours, cette année, depuis toujours, période personnalisée

### 4. **Gestion des Collaborateurs**
- **Ajout et modification** : Gestion complète des collaborateurs avec nom, téléphone et part
- **Répartition des revenus** : Calcul automatique du wallet de chaque collaborateur
- **Suivi des parts** : Visualisation claire de la répartition des bénéfices

### 5. **Notifications**
- **Système de notifications** : Alertes pour les ventes, stock faible, transactions
- **Notifications push** : Notifications en temps réel dans le navigateur
- **Notifications email** : Configuration des types de notifications par email

### 6. **Paramètres et Personnalisation**
- **Interface** : Thème sombre/clair, sélection de la langue (Français/Anglais)
- **Notifications** : Configuration des notifications email et push
- **Fonctionnalités** : Activation/désactivation des analytics et rapports automatiques
- **Affichage** : Densité des tableaux, type de graphique par défaut
- **Seuils et alertes** : Configuration des seuils de stock faible et limites de transactions
- **Devise** : Sélection de la devise d'affichage (FCFA, EUR, USD, XOF)
- **Sauvegarde** : Configuration de la sauvegarde automatique et export des données
- **Réinitialisation** : Options pour réinitialiser les paramètres ou les données

### 7. **Tableau de Bord**
- **Vue d'ensemble** : Statistiques clés en un coup d'œil
- **Actions rapides** : Accès rapide pour ajouter une vente, une dépense ou un produit
- **Transactions récentes** : Affichage des 5 dernières transactions
- **Graphiques interactifs** : Visualisation des ventes et dépenses, top produits

## 🛠️ Technologies Utilisées

### Frontend
- **Next.js 16** (App Router) : Framework React pour le développement web
- **TypeScript** : Typage statique pour une meilleure maintenabilité
- **TailwindCSS** : Framework CSS utilitaire
- **Shadcn UI** : Bibliothèque de composants UI modernes et accessibles
- **TanStack Query (React Query)** : Gestion des données serveur et cache
- **SWR** : Alternative pour la récupération de données
- **React Hook Form + Zod** : Gestion et validation des formulaires
- **Recharts** : Bibliothèque de graphiques React
- **Axios** : Client HTTP pour les appels API
- **Sonner** : Système de notifications toast
- **next-themes** : Gestion du thème sombre/clair

### Backend (Laravel)
- **Laravel Sanctum** : Authentification par cookies HTTP-only
- **API RESTful** : Endpoints pour toutes les opérations CRUD
- **CSRF Protection** : Protection contre les attaques CSRF

### Internationalisation
- **Système i18n personnalisé** : Support multilingue (Français/Anglais)
- **Context API** : Gestion de l'état de la langue
- **localStorage** : Persistance de la préférence de langue

## 📁 Architecture du Projet

```
front_trade_manager/
├── app/
│   ├── (auth)/          # Pages d'authentification
│   └── (dashboard)/     # Pages du tableau de bord
│       ├── analytics/   # Page d'analyses
│       ├── products/    # Gestion des produits
│       ├── wallet/      # Gestion des transactions
│       ├── collaborators/ # Gestion des collaborateurs
│       ├── settings/    # Paramètres
│       └── notifications/ # Notifications
├── components/          # Composants React réutilisables
│   ├── analytics/      # Composants d'analyses
│   ├── products/       # Composants produits
│   ├── wallet/         # Composants transactions
│   └── ui/             # Composants UI Shadcn
├── lib/
│   ├── services/       # Services API
│   ├── hooks/          # Hooks personnalisés
│   ├── i18n/           # Système d'internationalisation
│   └── utils/          # Utilitaires
└── contexts/           # Contextes React (Auth, Language)
```

## 🔐 Sécurité

- **Authentification sécurisée** : Laravel Sanctum avec cookies HTTP-only
- **Protection CSRF** : Gestion automatique des tokens CSRF
- **Routes protégées** : Vérification de l'authentification sur toutes les pages
- **Gestion des erreurs** : Gestion centralisée des erreurs 401, 419, 500
- **Validation côté client et serveur** : Double validation avec Zod et Laravel

## 📊 Fonctionnalités Avancées

### Prédictions de Réapprovisionnement
- Calcul automatique basé sur les ventes moyennes
- Estimation des jours restants avant épuisement
- Alertes visuelles (Épuisé, Urgent, En stock)
- Filtrage et recherche dans les prédictions

### Analytics Avancées
- Comparaisons temporelles avec pourcentages de variation
- Graphiques interactifs avec zoom et filtres
- Export des données (CSV, Excel)
- Analyses par période personnalisée

### Gestion Multi-collaborateurs
- Répartition automatique des revenus selon les parts
- Suivi individuel du wallet de chaque collaborateur
- Interface de gestion complète

## 🌍 Internationalisation

L'application supporte actuellement :
- **Français** (langue par défaut)
- **Anglais**

Tous les textes statiques sont traduits, permettant une utilisation fluide dans les deux langues.

## 📱 Responsive Design

L'application est entièrement responsive et s'adapte à tous les types d'écrans :
- Desktop
- Tablette
- Mobile

## 🎨 Interface Utilisateur

- **Design moderne** : Interface épurée et professionnelle
- **Thème sombre/clair** : Support du mode sombre pour le confort visuel
- **Animations fluides** : Transitions et animations pour une meilleure UX
- **Skeleton loaders** : Indicateurs de chargement élégants
- **Feedback visuel** : Toasts, alertes et confirmations pour toutes les actions

## 🔄 Synchronisation en Temps Réel

- **Rafraîchissement automatique** : Mise à jour automatique après chaque action
- **Cache intelligent** : Gestion optimale du cache pour des performances fluides
- **Invalidation sélective** : Rechargement ciblé des données modifiées

## 📈 Performance

- **Optimisation des requêtes** : Utilisation de TanStack Query pour le cache et la déduplication
- **Lazy loading** : Chargement différé des composants
- **Code splitting** : Division automatique du code par Next.js
- **Optimisation des images** : Gestion optimale des images avec Next.js

## 🎯 Cas d'Usage

Cette application est idéale pour :
- **Petits commerces** : Gestion complète de l'inventaire et des ventes
- **Boutiques en ligne** : Suivi des stocks et des transactions
- **Entrepreneurs** : Analyse des performances et optimisation des décisions
- **Équipes commerciales** : Gestion collaborative avec répartition des revenus
- **Gestionnaires de stock** : Prédictions et alertes pour optimiser les réapprovisionnements

## 🚀 État du Projet

Le projet est en développement actif avec :
- ✅ Authentification complète
- ✅ Gestion des produits (CRUD complet)
- ✅ Gestion des transactions (ventes et dépenses)
- ✅ Analytics et statistiques avancées
- ✅ Gestion des collaborateurs
- ✅ Système de notifications
- ✅ Paramètres et personnalisation
- ✅ Internationalisation (FR/EN)
- ✅ Interface responsive
- ✅ Thème sombre/clair

---

**Trade Manager** - Simplifiez la gestion de votre commerce avec des outils puissants et une interface intuitive.

