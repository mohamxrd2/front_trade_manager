/**
 * Hôtes d'images servies par next/image (optimisées, chargement différé).
 * Utilisé par next.config.ts (images.remotePatterns) et par MediaImage, qui
 * affiche tout autre hôte tel quel (unoptimized) plutôt que de planter.
 */

export interface RemotePattern {
  protocol: 'http' | 'https'
  hostname: string
  port?: string
  pathname: string
}

function patternFor(url: string | undefined, pathname: string): RemotePattern | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return {
      protocol: parsed.protocol === 'http:' ? 'http' : 'https',
      hostname: parsed.hostname,
      port: parsed.port,
      pathname,
    }
  } catch {
    return null
  }
}

export function mediaRemotePatterns(env: Record<string, string | undefined> = process.env): RemotePattern[] {
  return [
    { protocol: 'https', hostname: 'ik.imagekit.io', port: '', pathname: '/**' },
    // Bucket Cloudflare R2 (adresse publique r2.dev)…
    { protocol: 'https', hostname: '*.r2.dev', port: '', pathname: '/**' },
    // …ou son domaine personnalisé (NEXT_PUBLIC_MEDIA_URL = MEDIA_DISK_URL du back).
    patternFor(env.NEXT_PUBLIC_MEDIA_URL, '/**'),
    // Images servies par l'API elle-même (développement local, anciens logos).
    patternFor(env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', '/storage/**'),
    // Photos de profil des comptes Google / Facebook.
    { protocol: 'https', hostname: 'lh3.googleusercontent.com', port: '', pathname: '/**' },
    { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com', port: '', pathname: '/**' },
  ].filter((p): p is RemotePattern => p !== null)
}

function hostMatches(pattern: string, hostname: string): boolean {
  return pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : pattern === hostname
}

function pathMatches(pattern: string, pathname: string): boolean {
  return pattern === '/**' || pathname.startsWith(pattern.replace(/\*\*$/, ''))
}

/** L'image peut-elle passer par l'optimiseur de Next (hôte autorisé) ? */
export function isOptimizable(src: string, patterns: RemotePattern[] = mediaRemotePatterns()): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  // L'optimiseur de Next refuse les adresses locales (développement) : image affichée telle quelle.
  if (/^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/.test(url.hostname)) return false
  const protocol = url.protocol.replace(':', '')
  return patterns.some(
    (p) => p.protocol === protocol && hostMatches(p.hostname, url.hostname) && (p.port ?? '') === url.port && pathMatches(p.pathname, url.pathname)
  )
}

/** URL affichable : http(s) ou aperçu local ; le reste (chaîne vide, nom de fichier…) est ignoré. */
export function displayableImage(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  if (v.startsWith('blob:') || v.startsWith('data:image/')) return v
  try {
    const url = new URL(v)
    return url.protocol === 'https:' || url.protocol === 'http:' ? v : null
  } catch {
    return null
  }
}
