# Configuration CORS pour Laravel Sanctum

Pour que votre frontend Next.js puisse communiquer avec votre API Laravel Sanctum, vous devez configurer CORS dans Laravel.

## Configuration dans Laravel

### 1. Installer le package CORS (si pas déjà fait)

```bash
composer require fruitcake/laravel-cors
```

### 2. Publier la configuration CORS

```bash
php artisan config:publish cors
```

### 3. Configurer le fichier `config/cors.php`

Ouvrez `config/cors.php` et configurez-le ainsi :

```php
<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true, // Important pour Sanctum
];
```

### 4. Vérifier le middleware dans `bootstrap/app.php` (Laravel 11)

Assurez-vous que le middleware CORS est activé :

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->api(prepend: [
        \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
    ]);
    
    $middleware->validateCsrfTokens(except: [
        'api/*',
    ]);
})
```

### 5. Vérifier le fichier `.env`

Assurez-vous que `SANCTUM_STATEFUL_DOMAINS` est configuré :

```env
SANCTUM_STATEFUL_DOMAINS=localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001
SESSION_DRIVER=cookie
```

### 6. Redémarrer le serveur Laravel

```bash
php artisan serve
```

## Vérification

Pour vérifier que tout fonctionne, ouvrez la console du navigateur (F12) et vérifiez qu'il n'y a pas d'erreurs CORS.

Si vous voyez une erreur CORS, vérifiez :
1. Que le serveur Laravel est démarré sur `http://localhost:8000`
2. Que les origines sont correctement configurées dans `config/cors.php`
3. Que `SANCTUM_STATEFUL_DOMAINS` contient bien votre port Next.js
4. Que `supports_credentials` est à `true` dans la config CORS

## Dépannage

### Erreur "Impossible de se connecter au serveur"

1. Vérifiez que Laravel est démarré : `php artisan serve`
2. Testez l'endpoint dans votre navigateur : `http://localhost:8000/api/login`
3. Vérifiez les logs Laravel : `storage/logs/laravel.log`

### Erreur CORS

1. Vérifiez la configuration CORS dans `config/cors.php`
2. Vérifiez que `SANCTUM_STATEFUL_DOMAINS` contient votre port
3. Videz le cache Laravel : `php artisan config:clear`
4. Redémarrez le serveur Laravel
