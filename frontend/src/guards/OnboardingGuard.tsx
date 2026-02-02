import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { ComplianceStatus } from '../api/types';
import { isSuperAdmin } from '../auth/storage';

/**
 * Guard for onboarding routes (/onboarding, /onboarding/documents, /onboarding/waiting).
 * - SUPER_ADMIN: always allow (bypass).
 * - If company is ACTIVE (compliant): redirect to /dashboard.
 * - Otherwise: allow access (render child route).
 */
export function OnboardingGuard() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isSuperAdmin()) {
      setAllowed(true);
      return;
    }

    let cancelled = false;

    apiGet<ComplianceStatus>('/compliance/status')
      .then((compliance) => {
        if (cancelled) return;
        if (compliance.isCompliant) {
          navigate('/dashboard', { replace: true });
          setAllowed(false);
        } else {
          setAllowed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAllowed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <Outlet />;
}
