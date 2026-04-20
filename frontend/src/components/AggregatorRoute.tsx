import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../services/auth';

export default function AggregatorRoute() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  const user = getCurrentUser();
  if (user?.role !== 'AGGREGATOR') {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
