import type { PermissionOverride } from '@/lib/services/team'

/** Même règle que App\Support\Permissions::effectivePermissions() côté backend : défauts du rôle, puis overrides (granted=true ajoute, granted=false retire). */
export function effectivePermissionSet(defaults: string[], overrides: PermissionOverride[]): Set<string> {
  const set = new Set(defaults)
  for (const o of overrides) {
    if (o.granted) set.add(o.permission)
    else set.delete(o.permission)
  }
  return set
}

/** Overrides minimaux : ne garde que les permissions qui DIFFÈRENT des défauts du rôle. */
export function toggleOverride(
  permission: string,
  checked: boolean,
  defaults: string[],
  overrides: PermissionOverride[]
): PermissionOverride[] {
  const isDefault = defaults.includes(permission)
  const next = overrides.filter((o) => o.permission !== permission)
  if (checked !== isDefault) next.push({ permission, granted: checked })
  return next
}
