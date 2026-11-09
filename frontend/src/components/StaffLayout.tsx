import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Search, UserPlus, Wallet, X, Home } from 'lucide-react';
import { getCurrentUser, logout } from '../services/auth';
import { canSeeMoney, canWriteClients, roleLabel } from '../services/staffOps';

export default function StaffLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = getCurrentUser();
  const role = user?.role;

  const nav = [
    { to: '/staff', icon: Home, label: 'Home', end: true },
    { to: '/staff/find', icon: Search, label: 'Find client' },
    ...(canWriteClients(role)
      ? [{ to: '/staff/clients/new', icon: UserPlus, label: 'New client' }]
      : []),
    ...(canSeeMoney(role)
      ? [{ to: '/staff/money', icon: Wallet, label: 'Finance' }]
      : []),
  ];

  function handleLogout() {
    logout();
    navigate('/staff/login', { replace: true });
  }

  const displayName = user?.firstName?.trim() || 'Staff';

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-40 shadow-sm"
        style={{ background: 'linear-gradient(90deg, #134b7f 0%, #1a5a94 100%)' }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/staff" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain" />
            <div className="hidden sm:block">
              <div className="text-sm font-bold tracking-wide text-white">ASPIRE COWORKS</div>
              <div className="text-[11px] text-blue-100">Staff Ops · {roleLabel(role)}</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-blue-100">{displayName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <button
              type="button"
              className="md:hidden rounded-md p-1.5 text-white hover:bg-white/10"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-white/10 px-4 py-2 md:hidden">
            {nav.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
                    isActive ? 'bg-white/15 text-white' : 'text-blue-100'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
