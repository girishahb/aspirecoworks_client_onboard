import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../services/auth';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Calendar,
  Tag,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/admin/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/admin/pricing', icon: Tag, label: 'Pricing' },
  { to: '/admin/audit-log', icon: Shield, label: 'Audit Log' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  let user: ReturnType<typeof getCurrentUser> = null;
  try { user = getCurrentUser(); } catch { /* noop */ }

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'A'
    : 'A';
  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Admin';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain shrink-0" />
          <div>
            <p className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: 'Arial, sans-serif' }}>
              ASPIRE COWORKS
            </p>
            <p className="text-slate-500 text-xs">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} strokeWidth={2} />
                <span>{label}</span>
                {isActive && <ChevronRight className="ml-auto h-3 w-3 text-white/50" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50 mb-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #134b7f, #0d9488)' }}
          >
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{userName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role ?? 'Admin'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-full"
        style={{ background: '#0f172a' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative flex flex-col w-60 h-full shadow-2xl"
            style={{ background: '#0f172a' }}
          >
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Aspire Coworks" className="h-7 w-7 object-contain" />
            <span className="font-bold text-sm text-primary" style={{ fontFamily: 'Arial, sans-serif' }}>
              ASPIRE COWORKS
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
