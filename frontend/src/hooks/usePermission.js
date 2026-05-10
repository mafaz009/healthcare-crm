'use client';
import { useAuth } from './useAuth';

/**
 * Default permissions for each role.
 * These mirror the ROLE_PERMISSIONS object in backend/src/middleware/auth.js.
 * Keep these in sync whenever you change backend permissions.
 *
 * The frontend uses this ONLY for UI decisions (show/hide buttons).
 * The backend always re-validates — this is not a security boundary.
 */
const ROLE_DEFAULTS = {
  SUPER_ADMIN: {
    leads:        { create: true,  read: true, update: true, delete: true  },
    blogs:        { create: true,  read: true, update: true, delete: true,  publish: true  },
    appointments: { create: true,  read: true, update: true, delete: true  },
    staff:        { create: true,  read: true, update: true, delete: true  },
    doctors:      { create: true,  read: true, update: true, delete: true  },
    admin:        { auditLogs: true, stats: true, impersonate: true },
  },
  DOCTOR_ADMIN: {
    leads:        { create: true,  read: true, update: true, delete: true  },
    blogs:        { create: true,  read: true, update: true, delete: true,  publish: true  },
    appointments: { create: true,  read: true, update: true, delete: true  },
    staff:        { create: true,  read: true, update: true, delete: false },
    doctors:      { create: false, read: false, update: false, delete: false },
    admin:        { auditLogs: false, stats: false, impersonate: false },
    practice:     { read: true, update: true, regenerateKey: true },
  },
  STAFF: {
    leads:        { create: true,  read: true, update: true, delete: false },
    blogs:        { create: true,  read: true, update: false, delete: false, publish: false },
    appointments: { create: true,  read: true, update: true, delete: false },
    staff:        { create: false, read: false, update: false, delete: false },
    doctors:      { create: false, read: false, update: false, delete: false },
    admin:        { auditLogs: false, stats: false, impersonate: false },
  },
};

/**
 * Check if the current user can perform `action` on `resource`.
 *
 * For STAFF users, checks User.permissions JSON overrides first.
 * For SUPER_ADMIN and DOCTOR_ADMIN, uses role defaults (no overrides).
 *
 * @param {string} resource - e.g. 'leads', 'blogs', 'appointments', 'staff'
 * @param {string} action   - e.g. 'delete', 'publish', 'create', 'read'
 * @returns {boolean}
 *
 * @example
 * const canDelete = usePermission('leads', 'delete');
 * const canPublish = usePermission('blogs', 'publish');
 */
export function usePermission(resource, action) {
  const { user } = useAuth();
  if (!user) return false;

  const role = user.role;
  const roleDefault = ROLE_DEFAULTS[role]?.[resource]?.[action] ?? false;

  // STAFF: check per-user permission overrides from the User.permissions JSON
  if (role === 'STAFF' && user.permissions) {
    const override = user.permissions?.[resource]?.[action];
    if (typeof override === 'boolean') return override;
  }

  return roleDefault;
}

/**
 * Convenience hook — returns the full user role context.
 * Useful for conditional rendering based on role.
 *
 * @example
 * const { isAdmin, isDoctor, isStaff } = useRole();
 */
export function useRole() {
  const { user } = useAuth();
  return {
    role:     user?.role ?? null,
    isAdmin:  user?.role === 'SUPER_ADMIN',
    isDoctor: user?.role === 'DOCTOR_ADMIN',
    isStaff:  user?.role === 'STAFF',
    // Can manage staff: admin and doctor_admin
    canManageStaff: ['SUPER_ADMIN', 'DOCTOR_ADMIN'].includes(user?.role),
  };
}
