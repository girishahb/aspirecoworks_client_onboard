import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, isAuthenticated } from '../services/auth';
import Logo from './Logo';

export default function Layout() {
  const navigate = useNavigate();
  let user: ReturnType<typeof getCurrentUser> = null;
  let isAdmin = false;

  try {
    user = getCurrentUser();
    isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  } catch (error) {
    console.warn('Error getting current user in Layout:', error);
  }

  const authenticated = isAuthenticated();

  function handleLogout() {
    logout();
    const isAdminPath = window.location.pathname.startsWith('/admin');
    navigate(isAdminPath ? '/admin/login' : '/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border bg-white shadow-sm px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo to="/" />
          <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
            {authenticated ? (
              <>
                <Link to="/dashboard" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Dashboard</Link>
                {isAdmin ? (
                  <Link to="/admin/dashboard" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Admin</Link>
                ) : (
                  <Link to="/admin/login" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Admin</Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="transition-colors hover:opacity-80 bg-transparent border-none cursor-pointer font-medium p-0"
                  style={{ color: '#134b7f' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Login</Link>
                <Link to="/signup" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Signup</Link>
                <Link to="/dashboard" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Dashboard</Link>
                <Link to="/admin/login" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Admin</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
