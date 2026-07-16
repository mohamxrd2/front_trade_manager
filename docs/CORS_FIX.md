# 🚨 Correction Erreur CORS - Configuration Laravel

## ❌ Erreur Actuelle

```
Access-Control-Allow-Origin header in the response must not be the wildcard '*' 
when the request's credentials mode is 'include'
```

## 🔍 Cause du Problème

Le frontend utilise `withCredentials: true` pour envoyer les cookies, mais Laravel renvoie `Access-Control-Allow-Origin: *`, ce qui est **incompatible**.

**Règle CORS** : Quand `withCredentials: true`, l'origine doit être **explicite**, pas `*`.

## ✅ Solution : Configuration Laravel

### 1. Modifier `config/cors.php`

```php
<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    
    'allowed_methods' => ['*'],
    
    // ⚠️ IMPORTANT : Ne pas utiliser '*' quand supports_credentials est true
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // Ajoutez vos autres origines ici
    ],
    
    'allowed_origins_patterns' => [],
    
    'allowed_headers' => ['*'],
    
    'exposed_headers' => [],
    
    'max_age' => 0,
    
    // ⚠️ CRITIQUE : Doit être true pour les cookies
    'supports_credentials' => true,
];
```

### 2. Vérifier `.env` Laravel

```env
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
```

### 3. Vérifier `config/sanctum.php`

```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
    env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
))),
```

### 4. Vérifier `config/session.php`

```php
'domain' => env('SESSION_DOMAIN', null), // null pour localhost
'same_site' => 'lax',
'secure' => env('SESSION_SECURE_COOKIE', false), // true en production HTTPS
'http_only' => true,
```

## 🔧 Alternative : Middleware CORS Personnalisé (si nécessaire)

Si vous avez besoin d'un contrôle plus fin, créez un middleware :

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->headers->get('Origin');
        $allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
        
        if (in_array($origin, $allowedOrigins)) {
            return $next($request)
                ->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
        
        return $next($request);
    }
}
```

Enregistrez-le dans `app/Http/Kernel.php` :

```php
protected $middleware = [
    // ...
    \App\Http\Middleware\CorsMiddleware::class,
];
```

## 🧪 Test de la Configuration

Après modification, testez avec :

```bash
curl -X OPTIONS http://localhost:8000/api/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

Vous devriez voir :
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: http://localhost:3000
< Access-Control-Allow-Credentials: true
< Access-Control-Allow-Methods: POST, GET, OPTIONS
```

## 📝 Checklist

- [ ] `config/cors.php` : `allowed_origins` contient `http://localhost:3000` (pas `*`)
- [ ] `config/cors.php` : `supports_credentials` est `true`
- [ ] `.env` : `SANCTUM_STATEFUL_DOMAINS` contient `localhost:3000`
- [ ] Redémarrer le serveur Laravel : `php artisan config:clear && php artisan serve`

## 🚀 Production

En production, remplacez `localhost:3000` par votre domaine réel :

```php
'allowed_origins' => [
    'https://votre-domaine.com',
],
```

```env
SANCTUM_STATEFUL_DOMAINS=votre-domaine.com
```

