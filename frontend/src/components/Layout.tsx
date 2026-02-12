import { Outlet, Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import Logo from './Logo';

export default function Layout() {
  let user: ReturnType<typeof getCurrentUser> = null;
  let isAdmin = false;
  
  try {
    user = getCurrentUser();
    isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  } catch (error) {
    // Silently handle errors (e.g., localStorage not available)
    console.warn('Error getting current user in Layout:', error);
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border bg-white shadow-sm px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo to="/" />
          <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
            <Link to="/login" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Login</Link>
            <Link to="/signup" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Signup</Link>
            <Link to="/dashboard" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Dashboard</Link>
            {isAdmin ? (
              <Link to="/admin/dashboard" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Admin</Link>
            ) : (
              <Link to="/admin/login" className="transition-colors hover:opacity-80" style={{ color: '#134b7f' }}>Admin</Link>
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
