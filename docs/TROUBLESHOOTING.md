# Guide de Débogage - Erreurs d'Authentification

## 🔍 Erreur 404 lors du login

### Diagnostic

Si vous obtenez une erreur 404, voici comment identifier le problème :

#### 1. Vérifier quel endpoint retourne 404

**Option A : Endpoint CSRF (`/sanctum/csrf-cookie`)**
- **Normal** : Si votre configuration Laravel n'utilise pas Sanctum CSRF, c'est normal
- **Solution** : L'erreur est ignorée automatiquement, le login continue

**Option B : Endpoint Login (`/api/login`)**
- **Problème** : La route n'existe pas dans Laravel
- **Solution** : Vérifier les routes Laravel

#### 2. Vérifier les routes Laravel

```bash
# Dans votre projet Laravel
php artisan route:list | grep login
```

Vous devriez voir quelque chose comme :
```
POST   api/login .......... AuthController@login
```

#### 3. Vérifier que l'API est accessible

```bash
# Tester l'endpoint directement
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"login":"test","password":"test"}'
```

**Résultat attendu** :
- `401 Unauthorized` → L'endpoint existe, les identifiants sont incorrects (normal)
- `404 Not Found` → L'endpoint n'existe pas (problème à corriger)

#### 4. Vérifier la configuration des routes Laravel

Dans `routes/api.php` :

```php
<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
```

#### 5. Vérifier le préfixe des routes API

Dans `app/Providers/RouteServiceProvider.php` ou `routes/api.php` :

```php
Route::prefix('api')->group(function () {
    // Vos routes ici
});
```

## 🔧 Solutions courantes

### Problème : Route `/api/login` retourne 404

**Solution 1 : Vérifier le préfixe**
```php
// routes/api.php
Route::prefix('api')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});
```

**Solution 2 : Vérifier le namespace du controller**
```php
use App\Http\Controllers\Auth\AuthController;
```

**Solution 3 : Vérifier que le middleware est correct**
```php
// Pour Sanctum avec cookies, pas besoin de middleware sur /login
Route::post('/login', [AuthController::class, 'login']);
```

### Problème : Endpoint CSRF retourne 404

**C'est normal** si vous n'utilisez pas Sanctum CSRF. Le code gère automatiquement cette erreur et continue.

Si vous voulez activer CSRF :
```php
// routes/web.php ou routes/api.php
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
});
```

## 📝 Console du navigateur

Ouvrez la console du navigateur (F12) et vérifiez :
- L'URL complète qui est appelée
- Le code de statut HTTP (404, 401, etc.)
- Les messages d'erreur détaillés

## 🚀 Test rapide

1. **Vérifier que Laravel est démarré** :
   ```bash
   php artisan serve
   ```

2. **Tester l'endpoint** :
   ```bash
   curl http://localhost:8000/api/login
   ```

3. **Vérifier les routes** :
   ```bash
   php artisan route:list
   ```

