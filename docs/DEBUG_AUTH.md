# 🔍 Guide de Diagnostic - Authentification

## Problèmes courants et solutions

### 1. Erreur 404 - Endpoint non trouvé

**Symptôme** : Message d'erreur "Endpoint non trouvé"

**Solution** : Vérifiez que vos routes Laravel sont correctes :

```bash
# Dans votre projet Laravel
php artisan route:list | grep -E "(login|register|logout|user)"
```

Vous devriez voir :
```
POST   api/login .......... AuthController@login
POST   api/register ....... AuthController@register  
POST   api/logout .......... AuthController@logout
GET    api/user ........... AuthController@user
```

**Si vos routes sont sous `/login` (sans `/api`)**, modifiez dans `services/auth.ts` :
- `/api/login` → `/login`
- `/api/register` → `/register`
- `/api/logout` → `/logout`

**Si votre baseURL est `http://localhost:8000/api`**, modifiez dans `lib/api.ts` :
- `baseURL: 'http://localhost:8000'` → `baseURL: 'http://localhost:8000/api'`
- Et utilisez `/login` au lieu de `/api/login`

### 2. Erreur CORS

**Symptôme** : Erreur dans la console "Access-Control-Allow-Origin"

**Solution** : Voir `docs/CORS_FIX.md`

Points essentiels :
- `config/cors.php` : `allowed_origins: ['http://localhost:3000']` (pas `*`)
- `config/cors.php` : `supports_credentials: true`

### 3. Erreur 401 - Identifiants incorrects

**Symptôme** : Message "Identifiants incorrects" même avec de bons identifiants

**Vérifications** :
1. Les identifiants sont corrects dans la base de données
2. Le format de la requête correspond à ce que Laravel attend :
   ```json
   {
     "login": "email@example.com",
     "password": "password123"
   }
   ```
3. Vérifiez que votre controller Laravel accepte bien `login` (peut être `email` ou `username`)

### 4. Cookie non créé

**Symptôme** : La connexion réussit mais l'utilisateur est déconnecté au refresh

**Vérifications** :
1. Ouvrez DevTools → Application → Cookies
2. Vérifiez qu'un cookie est créé après login
3. Vérifiez que `withCredentials: true` est présent dans Axios

### 5. Session perdue après refresh

**Symptôme** : L'utilisateur est déconnecté après F5

**Vérifications** :
1. Le cookie est bien présent (voir point 4)
2. Le cookie a une durée de vie suffisante côté Laravel
3. Vérifiez `config/session.php` dans Laravel

## 🧪 Test rapide

### Tester l'endpoint directement

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"login":"test@example.com","password":"password"}' \
  -v
```

**Résultat attendu** :
- `200 OK` avec les données utilisateur
- Un cookie `Set-Cookie` dans les headers

### Vérifier la configuration

1. **Frontend** (`lib/api.ts`) :
   ```typescript
   baseURL: 'http://localhost:8000'  // ou 'http://localhost:8000/api'
   withCredentials: true
   ```

2. **Backend Laravel** (`config/cors.php`) :
   ```php
   'allowed_origins' => ['http://localhost:3000'],
   'supports_credentials' => true,
   ```

3. **Backend Laravel** (`.env`) :
   ```env
   SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
   ```

## 📝 Console du navigateur

Ouvrez la console (F12) et vérifiez :
- Les requêtes réseau (onglet Network)
- Les erreurs dans la console
- Les cookies (Application → Cookies)

## 🔧 Configuration actuelle

- **baseURL** : `http://localhost:8000` (voir `lib/api.ts`)
- **Login endpoint** : `/api/login` (voir `services/auth.ts`)
- **User endpoint** : `/api/user` (voir `services/auth.ts`)
- **Logout endpoint** : `/api/logout` (voir `services/auth.ts`)

Si votre backend utilise des endpoints différents, modifiez-les dans `services/auth.ts`.

