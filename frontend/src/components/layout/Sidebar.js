'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';
import {
  HomeIcon, UserGroupIcon, ClipboardDocumentListIcon,
  CalendarDaysIcon, DocumentTextIcon, Cog6ToothIcon,
  XMarkIcon, HeartIcon,
} from '@heroicons/react/24/outline';

const NAV = [
  { href: '/dashboard',              icon: HomeIcon,                      label: 'Dashboard' },
  { href: '/dashboard/doctors',      icon: UserGroupIcon,                 label: 'Doctors',      adminOnly: true },
  { href: '/dashboard/leads',        icon: ClipboardDocumentListIcon,     label: 'Leads' },
  { href: '/dashboard/appointments', icon: CalendarDaysIcon,              label: 'Appointments' },
  { href: '/dashboard/blogs',        icon: DocumentTextIcon,              label: 'Blogs' },
  { href: '/dashboard/settings',     icon: Cog6ToothIcon,                 label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user }  = useAuth();

  const items = NAV.filter((n) => !n.adminOnly || user?.role === 'SUPER_ADMIN');

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const content = (
    <div className="flex flex-col h-full bg-slate-900 w-64">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
          <HeartIcon className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-semibold text-lg leading-tight">Healthcare CRM</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">{content}</div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="relative flex z-50">
            {content}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
