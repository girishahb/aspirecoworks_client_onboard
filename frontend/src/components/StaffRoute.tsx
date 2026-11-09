import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentUser, isAuthenticated } from '../services/auth';
import { isStaffPortalRole } from '../services/staffOps';

/**
 * Protects Staff Ops routes: Reception / Staff / Finance (+ admin/manager).
 */
export default function StaffRoute() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }
  const user = getCurrentUser();
  if (!isStaffPortalRole(user?.role)) {
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
