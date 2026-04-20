import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import AdminLayout from './components/AdminLayout';
import AggregatorLayout from './components/AggregatorLayout';
import ClientLayout from './components/ClientLayout';
import PublicLayout from './components/PublicLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AggregatorRoute from './components/AggregatorRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SetPassword from './pages/SetPassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
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
import AdminBookings from './pages/AdminBookings';
import AdminPricing from './pages/AdminPricing';
import AdminAggregatorUsers from './pages/AdminAggregatorUsers';
import AdminCustomers from './pages/AdminCustomers';
import AggregatorDashboard from './pages/AggregatorDashboard';
import AggregatorCreateCompany from './pages/AggregatorCreateCompany';
import AggregatorInvoices from './pages/AggregatorInvoices';
import AggregatorPayments from './pages/AggregatorPayments';
import Book from './pages/Book';
import BookListing from './pages/BookListing';
import BookSuccess from './pages/BookSuccess';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Auth pages — split-panel brand layout */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="set-password" element={<SetPassword />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="admin/login" element={<AdminLogin />} />
      </Route>

      {/* Client portal — brand-forward top-nav layout */}
      <Route element={<ClientLayout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="client/documents" element={<ClientDocuments />} />
          <Route path="client/payments" element={<ClientPayments />} />
          <Route path="client/invoices" element={<ClientInvoices />} />
          <Route path="client/profile" element={<ClientProfile />} />
        </Route>
      </Route>

      {/* Admin portal — dark sidebar layout */}
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/login" replace />} />
        <Route element={<AdminRoute />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="companies/new" element={<AdminCreateCompany />} />
          <Route path="companies/:companyId" element={<AdminCompanyDetail />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="aggregator-users" element={<AdminAggregatorUsers />} />
        </Route>
      </Route>

      {/* Aggregator portal — partner-facing sidebar layout */}
      <Route path="aggregator" element={<AggregatorLayout />}>
        <Route index element={<Navigate to="/aggregator/dashboard" replace />} />
        <Route element={<AggregatorRoute />}>
          <Route path="dashboard" element={<AggregatorDashboard />} />
          <Route path="companies/new" element={<AggregatorCreateCompany />} />
          <Route path="companies/:companyId" element={<AdminCompanyDetail />} />
          <Route path="invoices" element={<AggregatorInvoices />} />
          <Route path="payments" element={<AggregatorPayments />} />
        </Route>
      </Route>

      {/* Public pages — clean header layout */}
      <Route element={<PublicLayout />}>
        <Route path="book" element={<BookListing />} />
        <Route path="book/success" element={<BookSuccess />} />
        <Route path="book/:resourceId" element={<Book />} />
        <Route path="booking-success" element={<BookSuccess />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms-of-service" element={<TermsOfService />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
