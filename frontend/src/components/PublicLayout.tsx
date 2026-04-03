import { Outlet, Link } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/auth';

export default function PublicLayout() {
  const navigate = useNavigate();
  let user: ReturnType<typeof getCurrentUser> = null;
  const authenticated = isAuthenticated();
  try { user = getCurrentUser(); } catch { /* noop */ }
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain" />
              <span className="font-bold text-sm tracking-wide" style={{ color: '#134b7f', fontFamily: 'Arial, sans-serif' }}>
                ASPIRE COWORKS
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/book" className="text-slate-600 hover:text-primary font-medium transition-colors">
                Book a Space
              </Link>
              {authenticated ? (
                <>
                  {isAdmin ? (
                    <Link to="/admin/dashboard" className="text-slate-600 hover:text-primary font-medium transition-colors">
                      Dashboard
                    </Link>
                  ) : (
                    <Link to="/dashboard" className="text-slate-600 hover:text-primary font-medium transition-colors">
                      Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-slate-600 hover:text-primary font-medium transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-slate-600 hover:text-primary font-medium transition-colors">
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
                    style={{ background: '#134b7f' }}
                  >
                    Get started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Aspire Coworks · Indiranagar, Bengaluru
          </p>
        </div>
      </footer>
    </div>
  );
}
