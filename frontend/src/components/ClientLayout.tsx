import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { getCurrentUser, logout } from '../services/auth';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Receipt,
  User,
  CalendarDays,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/client/documents', icon: FileText, label: 'Documents' },
  { to: '/client/payments', icon: CreditCard, label: 'Payments' },
  { to: '/client/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/client/profile', icon: User, label: 'Profile' },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  let user: ReturnType<typeof getCurrentUser> = null;
  try { user = getCurrentUser(); } catch { /* noop */ }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'C'
    : 'C';
  const displayName = user ? `${user.firstName ?? ''}`.trim() || 'there' : 'there';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav Bar */}
      <header
        className="sticky top-0 z-40 shadow-sm"
        style={{ background: 'linear-gradient(90deg, #134b7f 0%, #1a5a94 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain" />
              <span
                className="font-bold text-white text-sm tracking-wide hidden sm:block"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                ASPIRE COWORKS
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-blue-200'}`} strokeWidth={2} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
              <Link
                to="/book"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-blue-100 hover:text-white hover:bg-white/10 transition-all duration-150"
              >
                <CalendarDays className="h-3.5 w-3.5 text-blue-200" strokeWidth={2} />
                Book a Space
              </Link>
            </nav>

            {/* User + Logout */}
            <div className="flex items-center gap-2">
              {/* Greeting - desktop only */}
              <span className="hidden lg:block text-xs text-blue-200">
                Hello, <span className="text-white font-medium">{displayName}</span>
              </span>

              {/* Avatar */}
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 hidden md:flex"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                {userInitials}
              </div>

              {/* Logout - desktop */}
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-blue-100 hover:text-white hover:bg-white/10 transition-all duration-150"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                Sign out
              </button>

              {/* Mobile hamburger */}
              <button
                className="md:hidden text-white p-1"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div
            className="absolute right-0 top-0 h-full w-64 shadow-2xl flex flex-col"
            style={{ background: '#134b7f' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <span className="text-white font-bold text-sm">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="text-blue-200 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-blue-300'}`} strokeWidth={2} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
              <Link
                to="/book"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-white/10 transition-all"
              >
                <CalendarDays className="h-4 w-4 text-blue-300" strokeWidth={2} />
                Book a Space
              </Link>
            </nav>

            <div className="px-3 py-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-blue-100 hover:text-white hover:bg-white/10 transition-all"
              >
                <LogOut className="h-4 w-4 text-blue-300" strokeWidth={2} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
