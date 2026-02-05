import { Outlet, Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import Logo from './Logo';

export default function Layout() {
  let user: ReturnType<typeof getCurrentUser> = null;
  let isAdmin = false;
  
  try {
    user = getCurrentUser();
    isAdmin = user?.role === 'ADMIN';
  } catch (error) {
    // Silently handle errors (e.g., localStorage not available)
    console.warn('Error getting current user in Layout:', error);
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo to="/" />
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="text-primary hover:text-accent">Login</Link>
            <Link to="/signup" className="text-primary hover:text-accent">Signup</Link>
            <Link to="/dashboard" className="text-primary hover:text-accent">Dashboard</Link>
            {isAdmin ? (
              <Link to="/admin/dashboard" className="text-primary hover:text-accent">Admin</Link>
            ) : (
              <Link to="/admin/login" className="text-primary hover:text-accent">Admin</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
