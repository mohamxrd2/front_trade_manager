# Intégration API Laravel - Frontend Next.js

## 📋 Vue d'ensemble

Ce document explique comment le frontend Next.js est connecté au backend Laravel pour afficher les données réelles des produits et statistiques.

## 🔄 Flux de données

### 1. Architecture générale

```
Backend Laravel (localhost:8000)
    ↓
API Endpoints
    ↓
Services (lib/services/articles.ts)
    ↓
Hooks SWR (lib/hooks/useArticles.ts)
    ↓
Composants React (components/products/*)
    ↓
Pages Next.js (app/(dashboard)/products/*)
```

### 2. Endpoints utilisés

#### GET `/api/user`
- **Description** : Récupère les statistiques de l'utilisateur connecté
- **Retourne** :
  ```typescript
  {
    total_articles: number
    total_remaining_quantity: number
    total_stock_value: number
    total_low_stock: number
    // ... autres champs utilisateur
  }
  ```
- **Authentification** : Cookie HTTP-only (géré automatiquement par Axios)

#### GET `/api/articles`
- **Description** : Récupère la liste de tous les articles de l'utilisateur
- **Retourne** : Array d'articles
  ```typescript
  [
    {
      id: number
      name: string
      sale_price: number
      quantity: number
      type: 'simple' | 'variable'
      image: string | null
      sold_quantity: number
      remaining_quantity: number
      sales_percentage: number
      low_stock: boolean
      stock_value: number
    }
  ]
  ```
- **Authentification** : Cookie HTTP-only (géré automatiquement par Axios)

#### GET `/api/articles/{id}`
- **Description** : Récupère un article spécifique par son ID
- **Retourne** : Un seul article (même structure que ci-dessus)
- **Authentification** : Cookie HTTP-only (géré automatiquement par Axios)

## 📁 Structure des fichiers

### Services API (`lib/services/articles.ts`)

Contient les fonctions qui appellent directement l'API Laravel :

- `getUserStats()` : Récupère les statistiques utilisateur
- `getArticles()` : Récupère la liste des articles
- `getArticleById(id)` : Récupère un article spécifique

**Gestion des erreurs** :
- **401** : Redirection automatique vers `/login`
- **500** : Log de l'erreur et throw avec message clair
- **Autres** : Log et throw de l'erreur

### Hooks SWR (`lib/hooks/useArticles.ts`)

Hooks React personnalisés qui utilisent SWR pour la mise en cache :

- `useUserStats()` : Hook pour les statistiques utilisateur
- `useArticles()` : Hook pour la liste des articles
- `useArticle(id)` : Hook pour un article spécifique

**Avantages de SWR** :
- Cache automatique des données
- Revalidation automatique au focus de la fenêtre
- Dédoublonnage des requêtes
- Retry automatique en cas d'erreur

### Composants (`components/products/*`)

#### `ProductsHeader`
- Affiche 4 cartes de statistiques
- Utilise les données de `useUserStats()`

#### `ProductCard`
- Affiche une carte produit
- Accepte soit `Product` soit `Article` (conversion automatique)
- Affiche : nom, prix, quantités, barre de progression, badges

#### `ProductsGrid`
- Grille responsive de `ProductCard`
- Accepte soit `Product[]` soit `Article[]`

#### `ProductsListHeader`
- En-tête avec titre et bouton "Ajouter"
- Gère l'ouverture du modal d'ajout

### Pages (`app/(dashboard)/products/*`)

#### `page.tsx` (liste des produits)
- Utilise `useUserStats()` et `useArticles()`
- Affiche les skeletons pendant le chargement
- Gère les erreurs avec des messages clairs
- Passe les articles directement à `ProductsGrid`

#### `[id]/page.tsx` (détail d'un produit)
- Utilise `useArticle(id)` pour récupérer un article spécifique
- Affiche toutes les informations détaillées
- Gère le chargement et les erreurs

## 🔧 Configuration

### Axios (`lib/api.ts`)

L'instance Axios est configurée avec :
- `baseURL: 'http://localhost:8000'`
- `withCredentials: true` (pour les cookies HTTP-only)
- Intercepteurs pour CSRF (POST/PUT/DELETE)

### SWR

SWR est configuré avec :
- Revalidation au focus
- Revalidation à la reconnexion
- Dédoublonnage des requêtes (5-10 secondes)
- Retry automatique (2-3 tentatives)

## 🎨 Gestion du chargement

### Skeletons

Des composants skeleton sont disponibles dans `components/products/products-skeleton.tsx` :
- `ProductsHeaderSkeleton` : Pour l'en-tête de statistiques
- `ProductCardSkeleton` : Pour une carte produit
- `ProductsGridSkeleton` : Pour la grille complète

### États de chargement

Les hooks SWR retournent :
- `isLoading` : true pendant le chargement initial
- `error` : Erreur si la requête échoue
- `data` : Les données une fois chargées

## ⚠️ Gestion des erreurs

### Erreur 401 (Non authentifié)
- Redirection automatique vers `/login`
- Gérée dans les services API

### Erreur 500 (Erreur serveur)
- Message d'erreur affiché dans une `Alert`
- Log dans la console (mode développement)

### Erreur réseau
- Message d'erreur générique
- Suggestion de rafraîchir la page

## 🔄 Conversion des données

Les articles de l'API Laravel (`Article`) sont convertis en format `Product` pour la compatibilité avec les composants existants :

```typescript
function articleToProduct(article: Article): Product {
  return {
    id: String(article.id),
    name: article.name,
    type: article.type,
    quantity_sold: article.sold_quantity,
    quantity_remaining: article.remaining_quantity,
    price: article.sale_price,
    low_stock_threshold: article.low_stock ? 10 : undefined,
  }
}
```

## 📝 Utilisation

### Dans une page

```typescript
'use client'

import { useUserStats, useArticles } from '@/lib/hooks/useArticles'

export default function MyPage() {
  const { stats, isLoading: isLoadingStats } = useUserStats()
  const { articles, isLoading: isLoadingArticles } = useArticles()
  
  if (isLoadingStats || isLoadingArticles) {
    return <div>Chargement...</div>
  }
  
  return (
    <div>
      <p>Total articles: {stats?.total_articles}</p>
      <p>Articles: {articles.length}</p>
    </div>
  )
}
```

### Dans un composant

```typescript
import { useArticles } from '@/lib/hooks/useArticles'
import { ProductsGrid } from '@/components/products/products-grid'

export function MyComponent() {
  const { articles, isLoading } = useArticles()
  
  if (isLoading) return <div>Chargement...</div>
  
  return <ProductsGrid products={articles} />
}
```

## 🚀 Prochaines étapes

1. **Ajout de produit** : Implémenter `POST /api/articles` dans le service
2. **Modification de produit** : Implémenter `PUT /api/articles/{id}`
3. **Suppression de produit** : Implémenter `DELETE /api/articles/{id}`
4. **Optimistic updates** : Utiliser `mutate()` de SWR pour mettre à jour le cache immédiatement

## 📚 Ressources

- [SWR Documentation](https://swr.vercel.app/)
- [Axios Documentation](https://axios-http.com/)
- [Next.js App Router](https://nextjs.org/docs/app)

