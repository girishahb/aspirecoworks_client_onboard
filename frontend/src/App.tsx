import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import AdminLayout from './components/AdminLayout';
import AggregatorLayout from './components/AggregatorLayout';
import ClientLayout from './components/ClientLayout';
import PublicLayout from './components/PublicLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AggregatorRoute from './components/AggregatorRoute';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const SetPassword = lazy(() => import('./pages/SetPassword'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientDocuments = lazy(() => import('./pages/ClientDocuments'));
const ClientPayments = lazy(() => import('./pages/ClientPayments'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const ClientInvoices = lazy(() => import('./pages/ClientInvoices'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminInvoices = lazy(() => import('./pages/AdminInvoices'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminCompanyDetail = lazy(() => import('./pages/AdminCompanyDetail'));
const AdminCreateCompany = lazy(() => import('./pages/AdminCreateCompany'));
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminBookings = lazy(() => import('./pages/AdminBookings'));
const AdminPricing = lazy(() => import('./pages/AdminPricing'));
const AdminAggregatorUsers = lazy(() => import('./pages/AdminAggregatorUsers'));
const AdminCustomers = lazy(() => import('./pages/AdminCustomers'));
const AggregatorDashboard = lazy(() => import('./pages/AggregatorDashboard'));
const AggregatorCreateCompany = lazy(() => import('./pages/AggregatorCreateCompany'));
const AggregatorInvoices = lazy(() => import('./pages/AggregatorInvoices'));
const AggregatorPayments = lazy(() => import('./pages/AggregatorPayments'));
const AggregatorInvoiceProfile = lazy(() => import('./pages/AggregatorInvoiceProfile'));
const Book = lazy(() => import('./pages/Book'));
const BookListing = lazy(() => import('./pages/BookListing'));
const BookSuccess = lazy(() => import('./pages/BookSuccess'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
            <Route path="invoice-profile" element={<AggregatorInvoiceProfile />} />
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
    </Suspense>
  );
}
