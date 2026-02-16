import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ClientDocuments from './pages/ClientDocuments';
import ClientPayments from './pages/ClientPayments';
import ClientProfile from './pages/ClientProfile';
import ClientInvoices from './pages/ClientInvoices';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminLogin from './pages/AdminLogin';
import AdminInvoices from './pages/AdminInvoices';
import AdminDashboard from './pages/AdminDashboard';
import AdminCompanyDetail from './pages/AdminCompanyDetail';
import AdminCreateCompany from './pages/AdminCreateCompany';
import AdminAuditLog from './pages/AdminAuditLog';
import AdminPayments from './pages/AdminPayments';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms-of-service" element={<TermsOfService />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="client/documents" element={<ClientDocuments />} />
          <Route path="client/payments" element={<ClientPayments />} />
          <Route path="client/invoices" element={<ClientInvoices />} />
          <Route path="client/profile" element={<ClientProfile />} />
        </Route>
        <Route path="admin">
          <Route index element={<Navigate to="/admin/login" replace />} />
          <Route path="login" element={<AdminLogin />} />
          <Route element={<AdminRoute />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="companies/new" element={<AdminCreateCompany />} />
            <Route path="companies/:companyId" element={<AdminCompanyDetail />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="invoices" element={<AdminInvoices />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
