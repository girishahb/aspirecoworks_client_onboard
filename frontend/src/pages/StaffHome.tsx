import { Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canSeeMoney,
  canWriteClients,
  homeHint,
  roleLabel,
} from '../services/staffOps';

export default function StaffHome() {
  const user = getCurrentUser();
  const role = user?.role;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Aspire Coworks
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Hello, {user?.firstName || 'there'}
        </h1>
        <span
          className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            background: '#e8f1f8',
            borderColor: '#c9dae8',
            color: '#134b7f',
          }}
        >
          {roleLabel(role)}
        </span>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{homeHint(role)}</p>
      </section>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick actions
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/staff/find"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
          >
            <h2 className="text-base font-semibold text-slate-900">Find client</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by company, phone, booking ID, or contact name
            </p>
          </Link>

          {canWriteClients(role) && (
            <Link
              to="/staff/clients/new"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
            >
              <h2 className="text-base font-semibold text-slate-900">New client</h2>
              <p className="mt-1 text-sm text-slate-500">
                Onboard a client with Booking ID, notes, and agreement details
              </p>
            </Link>
          )}

          {canSeeMoney(role) && (
            <Link
              to="/staff/money"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
            >
              <h2 className="text-base font-semibold text-slate-900">Payments &amp; invoices</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review recent payments and invoices for finance follow-up
              </p>
            </Link>
          )}
        </div>
      </div>

      {role === 'RECEPTION' && (
        <div className="rounded-xl border border-blue-100 bg-[#e8f1f8] p-4 text-sm text-slate-700">
          <p className="font-semibold text-[#134b7f]">Front desk tip</p>
          <p className="mt-1">
            Open Find client → select the company → use Incoming mail to upload a photo and email
            the client.
          </p>
        </div>
      )}
    </div>
  );
}
