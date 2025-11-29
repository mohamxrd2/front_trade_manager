# Configuration Next.js + Laravel Sanctum (Cookies HTTP-only)

## 📋 Architecture

Cette configuration utilise **uniquement des cookies HTTP-only** pour l'authentification. Le token n'est **jamais stocké dans localStorage**.

### Flux d'authentification

1. **Connexion** : `POST /login` → Laravel crée un cookie HttpOnly
2. **Vérification** : `GET /api/user` → Le cookie est envoyé automatiquement
3. **Déconnexion** : `POST /logout` → Laravel supprime le cookie
4. **Refresh** : Le cookie persiste, `/api/user` renvoie les infos

## 📁 Structure des fichiers

```
lib/
  └── api.ts              # Configuration Axios avec withCredentials: true

services/
  └── auth.ts             # Fonctions login, logout, getUser

context/
  └── AuthContext.tsx     # Provider d'authentification + hook useAuth()

middleware.ts             # Protection des routes (optionnel)
```

## 🔧 Configuration

### 1. `lib/api.ts`

Configuration Axios centralisée :

```typescript
const api = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,  // ⚠️ CRITIQUE pour les cookies
})
```

### 2. `context/AuthContext.tsx`

- Gère `user` et `loading` dans le state
- Appelle `/api/user` au montage pour vérifier la session
- Fournit `login()` et `logout()`
- Redirige vers `/login` si 401

### 3. `services/auth.ts`

- `loginUser()` : POST /login
- `getUser()` : GET /api/user
- `logoutUser()` : POST /logout

## ✅ Utilisation

### Dans une page Next.js

```typescript
'use client'

import { useAuth } from '@/context/AuthContext'

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()

  if (loading) return <div>Chargement...</div>
  if (!user) return <div>Non connecté</div>

  return (
    <div>
      <h1>Bonjour {user.first_name} {user.last_name}</h1>
      <button onClick={logout}>Déconnexion</button>
    </div>
  )
}
```

### Dans un formulaire de connexion

```typescript
'use client'

import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const [credentials, setCredentials] = useState({ login: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await login(credentials)
    if (result.success) {
      router.push('/dashboard')
    } else {
      alert(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  )
}
```

## 🔒 Sécurité

### Avantages des cookies HTTP-only

- ✅ **Protection XSS** : Le cookie n'est pas accessible via `document.cookie`
- ✅ **Automatique** : Le navigateur envoie le cookie automatiquement
- ✅ **Persistant** : Survit aux refresh et fermeture du navigateur
- ✅ **Sécurisé** : Géré par le serveur, pas par JavaScript

### Ce qui est stocké

- **Cookie HttpOnly** : Token d'authentification (géré par Laravel)
- **localStorage** : Données utilisateur en cache uniquement (pour l'affichage)

## 🚀 Persistance après refresh

1. **Au refresh** : Le cookie est toujours présent
2. **AuthContext** : Appelle `/api/user` au montage
3. **Si valide** : Les données utilisateur sont restaurées
4. **Si 401** : Redirection vers `/login`

## ⚙️ Configuration Laravel requise

Voir `docs/AUTH_SETUP.md` et `docs/CORS_FIX.md` pour la configuration complète.

Points essentiels :
- `config/cors.php` : `allowed_origins: ['http://localhost:3000']` (pas `*`)
- `config/cors.php` : `supports_credentials: true`
- `.env` : `SANCTUM_STATEFUL_DOMAINS=localhost:3000`

## 🐛 Dépannage

### Erreur CORS

Vérifiez que `config/cors.php` a :
```php
'allowed_origins' => ['http://localhost:3000'],  // Pas '*'
'supports_credentials' => true,
```

### Session perdue après refresh

1. Vérifiez que le cookie est bien créé (DevTools → Application → Cookies)
2. Vérifiez que `withCredentials: true` est présent dans Axios
3. Vérifiez que CORS est correctement configuré

### Erreur 401 après connexion

1. Vérifiez que `/api/user` existe dans Laravel
2. Vérifiez que le middleware `auth:sanctum` est appliqué
3. Vérifiez que `SANCTUM_STATEFUL_DOMAINS` inclut votre domaine

