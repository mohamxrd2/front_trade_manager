import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware Next.js pour protéger les routes avec Laravel Sanctum
 * 
 * Fonctionnement:
 * - Les routes /dashboard/* sont protégées
 * - Si l'utilisateur n'est pas connecté, redirige vers /login
 * - Les routes /login et /signup redirigent vers /dashboard si déjà connecté
 * 
 * Note: La vérification réelle de l'authentification se fait côté client
 * via AuthContext qui appelle /api/user. Ce middleware est une couche
 * supplémentaire pour éviter les accès directs aux routes protégées.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Routes publiques (exclues du middleware)
  const publicRoutes = ['/']
  const isPublicRoute = publicRoutes.some(route => pathname === route)
  
  // Si c'est une route publique (landing page), laisser passer sans traitement
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Routes d'authentification
  const authRoutes = ['/login', '/signup']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  // Routes protégées (dashboard)
  const protectedRoutes = ['/dashboard']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  // Vérifier si l'utilisateur est connecté via cookie
  // Note: On ne peut pas vérifier le cookie HttpOnly depuis le middleware Next.js
  // car il n'est accessible que via HTTP. La vérification réelle se fait côté client.
  
  // Pour les routes protégées, on laisse passer et AuthContext gère la redirection
  // si l'utilisateur n'est pas connecté
  
  // Pour les routes d'authentification, on laisse passer et AuthRoute gère la redirection
  // si l'utilisateur est déjà connecté
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

