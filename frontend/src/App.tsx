import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { AuthVerifyPage } from './auth/AuthVerifyPage';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { OnboardingDocumentsPage } from './onboarding/OnboardingDocumentsPage';
import { OnboardingWaitingPage } from './onboarding/OnboardingWaitingPage';
import { OnboardingGuard } from './guards/OnboardingGuard';
import { AdminGuard } from './guards/AdminGuard';
import { AdminCompaniesPage } from './admin/AdminCompaniesPage';
import { AdminCompanyDocumentsPage } from './admin/AdminCompanyDocumentsPage';

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Aspire Coworks</h1>
        <a
          href="/login"
          className="mt-4 inline-block text-stone-600 underline hover:text-stone-900"
        >
          Sign in
        </a>
        <span className="mx-2 text-stone-400">·</span>
        <a
          href="/onboarding"
          className="mt-4 inline-block text-stone-600 underline hover:text-stone-900"
        >
          Go to onboarding
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/verify" element={<AuthVerifyPage />} />
      <Route path="/onboarding" element={<OnboardingGuard />}>
        <Route index element={<OnboardingPage />} />
        <Route path="documents" element={<OnboardingDocumentsPage />} />
        <Route path="waiting" element={<OnboardingWaitingPage />} />
      </Route>
      <Route path="/dashboard" element={<div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-stone-600">Dashboard</p></div>} />
      <Route path="/admin" element={<AdminGuard />}>
        <Route path="companies" element={<AdminCompaniesPage />} />
        <Route path="companies/:companyId/documents" element={<AdminCompanyDocumentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
