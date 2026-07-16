# Guide de Migration : localStorage → Cookies HttpOnly

## 🎯 Objectif

Migrer de `localStorage` vers des **cookies HttpOnly** pour améliorer la sécurité et la persistance de l'authentification.

## 📋 Checklist de Migration

### 1. Configuration Backend Laravel ✅

- [ ] Configurer CORS avec `supports_credentials: true`
- [ ] Configurer `SANCTUM_STATEFUL_DOMAINS` dans `.env`
- [ ] Vérifier que les sessions utilisent les cookies
- [ ] Tester le endpoint `/api/user` avec cookies

### 2. Configuration Frontend Next.js ✅

- [x] Activer `withCredentials: true` dans axios
- [x] Modifier `AuthContext` pour utiliser les cookies
- [x] Adapter les services d'authentification
- [ ] Tester la connexion/déconnexion
- [ ] Tester la persistance après refresh

### 3. Nettoyage ✅

- [ ] Supprimer les anciens appels à `localStorage.getItem('auth_token')`
- [ ] Vérifier qu'aucun composant n'accède directement au token
- [ ] Tester tous les flux d'authentification

## 🔄 Différences Clés

### Avant (localStorage)
```typescript
// Token stocké dans localStorage
localStorage.setItem('auth_token', token)
const token = localStorage.getItem('auth_token')

// Token envoyé manuellement dans le header
headers: { Authorization: `Bearer ${token}` }
```

### Après (Cookies HttpOnly)
```typescript
// Token automatiquement dans le cookie (géré par le serveur)
// Pas besoin de stocker manuellement

// Cookie envoyé automatiquement par le navigateur
withCredentials: true // dans axios
```

## 🧪 Tests à Effectuer

1. **Connexion**
   - [ ] Se connecter avec identifiants valides
   - [ ] Vérifier que les données utilisateur s'affichent
   - [ ] Vérifier dans les DevTools que le cookie est présent

2. **Persistance**
   - [ ] Actualiser la page (F5)
   - [ ] Vérifier que l'utilisateur reste connecté
   - [ ] Vérifier que les données sont toujours affichées

3. **Déconnexion**
   - [ ] Se déconnecter
   - [ ] Vérifier que le cookie est supprimé
   - [ ] Vérifier la redirection vers `/login`

4. **Sécurité**
   - [ ] Vérifier que `document.cookie` ne contient pas le token
   - [ ] Tester avec plusieurs onglets (sessions multiples)

## 🐛 Dépannage

### Problème : CORS errors
**Solution** : Vérifier que `supports_credentials: true` est configuré côté Laravel

### Problème : Cookie non envoyé
**Solution** : Vérifier que `withCredentials: true` est dans axios

### Problème : Session non persistante
**Solution** : Vérifier `SANCTUM_STATEFUL_DOMAINS` dans `.env` Laravel

## 📚 Documentation

- Voir `AUTH_SETUP.md` pour la configuration complète
- Voir `context/AuthContext.tsx` pour l'implémentation
- Voir `lib/axios.ts` pour la configuration axios

