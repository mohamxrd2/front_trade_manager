# Configuration Authentification Sécurisée - Cookies HttpOnly

## 🎯 Architecture

Cette solution utilise **cookies HttpOnly** pour stocker le token d'authentification, ce qui est :
- ✅ **Sécurisé** : Protection contre XSS (cookie non accessible par JavaScript)
- ✅ **Persistant** : Survit aux refresh et fermeture du navigateur
- ✅ **Scalable** : Gère plusieurs sessions simultanées
- ✅ **Recommandé** : Approche officielle Laravel Sanctum pour SPA

## 📋 Configuration Laravel (Backend)

### 1. Configuration CORS (`config/cors.php`)

```php
<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['http://localhost:3000'], // URL de votre frontend Next.js
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true, // ⚠️ IMPORTANT : doit être true
];
```

### 2. Configuration Session (`config/session.php`)

```php
'domain' => env('SESSION_DOMAIN', null), // null pour localhost
'same_site' => 'lax', // ou 'strict' pour plus de sécurité
'secure' => env('SESSION_SECURE_COOKIE', false), // true en production HTTPS
'http_only' => true, // Protection contre XSS
```

### 3. Configuration Sanctum (`config/sanctum.php`)

```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
    env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
))),
```

### 4. Variables d'environnement Laravel (`.env`)

```env
SESSION_DRIVER=cookie
SESSION_DOMAIN=localhost
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
```

### 5. Controller d'authentification (exemple)

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        if (Auth::attempt([
            'email' => $credentials['login'],
            'password' => $credentials['password']
        ]) || Auth::attempt([
            'username' => $credentials['login'],
            'password' => $credentials['password']
        ])) {
            $request->session()->regenerate();
            
            $user = Auth::user();
            
            return response()->json([
                'success' => true,
                'message' => 'Connexion réussie',
                'data' => [
                    'user' => $user,
                    // Pas besoin de retourner le token, il est dans le cookie
                ]
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Identifiants incorrects'
        ], 401);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'message' => 'Déconnexion réussie'
        ]);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }
}
```

## 🔒 Sécurité

### Avantages des Cookies HttpOnly :
- ✅ **Protection XSS** : Le cookie n'est pas accessible via `document.cookie`
- ✅ **Protection CSRF** : Via SameSite=Strict
- ✅ **Persistance** : Survit aux refresh automatiquement
- ✅ **Sécurité serveur** : Le token est géré par le serveur

### Points d'attention :
- ⚠️ Configurer correctement CORS avec `supports_credentials: true`
- ⚠️ Utiliser HTTPS en production
- ⚠️ Configurer `same_site` selon vos besoins

## 🚀 Déploiement Production

```env
SESSION_SECURE_COOKIE=true
SESSION_DOMAIN=votre-domaine.com
SANCTUM_STATEFUL_DOMAINS=votre-domaine.com
```

