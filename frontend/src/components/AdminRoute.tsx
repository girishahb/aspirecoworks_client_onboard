import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../services/auth';

const ADMIN_ROLE = 'ADMIN';

/**
 * Protects child routes: requires authentication and role === ADMIN.
 * Redirects to /login if not authenticated or if user is not an admin.
 */
export default function AdminRoute() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  const user = getCurrentUser();
  if (user?.role !== ADMIN_ROLE) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
