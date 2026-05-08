'use client';
import { useAuth } from '@/hooks/useAuth';
import { Bars3Icon, ArrowRightOnRectangleIcon, BellIcon } from '@heroicons/react/24/outline';

export default function TopNav({ onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      {/* Doctor name for non-admin */}
      <div className="hidden md:block">
        {user?.doctor && (
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{user.doctor.name}</span>
            {' · '}{user.doctor.specialty}
          </p>
        )}
      </div>

      {/* Right: user + logout */}
      <div className="flex items-center gap-2 ml-auto">
        <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
          <BellIcon className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
