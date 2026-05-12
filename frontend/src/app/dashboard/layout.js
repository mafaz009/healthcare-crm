'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar      from '@/components/layout/Sidebar';
import TopNav       from '@/components/layout/TopNav';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Route-level access control.
 * Maps URL path prefixes to required roles.
 * Routes NOT listed here are accessible to any authenticated user.
 */
const PROTECTED_ROUTES = [
  { prefix: '/dashboard/doctors',    roles: ['SUPER_ADMIN'] },
  { prefix: '/dashboard/audit-logs', roles: ['SUPER_ADMIN'] },
  { prefix: '/dashboard/staff',      roles: ['SUPER_ADMIN', 'DOCTOR_ADMIN'] },
  { prefix: '/dashboard/practice',   roles: ['DOCTOR_ADMIN'] },
  // leads/ingestion-logs accessible to DOCTOR_ADMIN and SUPER_ADMIN
  { prefix: '/dashboard/leads/ingestion-logs', roles: ['SUPER_ADMIN', 'DOCTOR_ADMIN'] },
];

function checkRouteAccess(pathname, userRole) {
  const match = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (!match) return true;
  return match.roles.includes(userRole);
}

// The forced-change page is always accessible to any authenticated user
const FORCE_CHANGE_PATH = '/dashboard/force-change-password';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Not logged in → redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // ── Forced password change gate ────────────────────────────────────────────
    // If mustChangePassword is set, block all dashboard routes except the
    // force-change page. The user must change their password before proceeding.
    if (user.mustChangePassword && pathname !== FORCE_CHANGE_PATH) {
      router.replace(FORCE_CHANGE_PATH);
      return;
    }

    // Once password is cleared, exit the force-change page automatically
    if (!user.mustChangePassword && pathname === FORCE_CHANGE_PATH) {
      router.replace('/dashboard');
      return;
    }

    // Logged in but insufficient role for this route → redirect to dashboard home
    if (!checkRouteAccess(pathname, user.role)) {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user || !checkRouteAccess(pathname, user.role)) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
