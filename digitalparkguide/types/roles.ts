// A2.1 — Role enum & permission matrix
// Roles (ascending privilege): PUBLIC_USER → GUIDE → SENIOR_GUIDE → HOD → SUPERADMIN

export type AppRole =
  | 'SUPERADMIN'
  | 'HOD'
  | 'SENIOR_GUIDE'
  | 'GUIDE'
  | 'PUBLIC_USER'

/** Human-readable labels for UI dropdowns */
export const ROLE_LABELS: Record<AppRole, string> = {
  SUPERADMIN:   'Superadmin',
  HOD:          'HoD',
  SENIOR_GUIDE: 'Senior Guide',
  GUIDE:        'Guide',
  PUBLIC_USER:  'Public User',
}

/** Numeric hierarchy — higher = more privilege */
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  SUPERADMIN:   4,
  HOD:          3,
  SENIOR_GUIDE: 2,
  GUIDE:        1,
  PUBLIC_USER:  0,
}

/** Returns true if userRole meets the minimum required role */
export function hasMinRole(userRole: AppRole | undefined, required: AppRole): boolean {
  if (!userRole) return required === 'PUBLIC_USER'
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]
}

/**
 * Route → minimum role needed to access.
 * Middleware iterates this map for /dashboard sub-routes.
 */
export const PROTECTED_ROUTES: Array<{ prefix: string; minRole: AppRole }> = [
  { prefix: '/admin',            minRole: 'SUPERADMIN' },
  { prefix: '/dashboard/admin',  minRole: 'SUPERADMIN' },
  { prefix: '/dashboard/hod',    minRole: 'HOD' },
  { prefix: '/senior-guide',     minRole: 'SENIOR_GUIDE' },
  { prefix: '/dashboard',        minRole: 'GUIDE' },
]

/** Granular permission matrix per role */
export const PERMISSION_MATRIX: Record<AppRole, string[]> = {
  SUPERADMIN: ['*'],
  HOD: [
    'view:all-guides',
    'manage:department',
    'view:reports',
    'approve:certifications',
    'manage:announcements',
  ],
  SENIOR_GUIDE: [
    'mentor:guides',
    'view:own-guides',
    'view:training-modules',
    'submit:attendance',
    'view:own-certifications',
  ],
  GUIDE: [
    'view:guide-modules',
    'view:own-training',
    'view:own-certifications',
    'view:announcements',
  ],
  PUBLIC_USER: [
    'view:announcements',
    'view:training-programmes',
  ],
}

export function can(userRole: AppRole | undefined, permission: string): boolean {
  const role = userRole ?? 'PUBLIC_USER'
  const perms = PERMISSION_MATRIX[role]
  return perms.includes('*') || perms.includes(permission)
}
