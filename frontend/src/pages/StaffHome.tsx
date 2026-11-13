import { Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canSeeMoney,
  canWriteClients,
  homeHint,
  roleLabel,
} from '../services/staffOps';
import { canManageVisitors } from '../services/visitors';
import { canWorkTickets } from '../services/tickets';

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
          {canManageVisitors(role) && (
            <Link
              to="/staff/visitors/check-in"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
            >
              <h2 className="text-base font-semibold text-slate-900">Visitor check-in</h2>
              <p className="mt-1 text-sm text-slate-500">
                Capture photo, signature, and optional Aadhaar for walk-ins and guests
              </p>
            </Link>
          )}

          {canManageVisitors(role) && (
            <Link
              to="/staff/visitors"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
            >
              <h2 className="text-base font-semibold text-slate-900">Today’s visitors</h2>
              <p className="mt-1 text-sm text-slate-500">
                See who is on site and check visitors out
              </p>
            </Link>
          )}

          {canWorkTickets(role) && (
            <Link
              to="/staff/tickets"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#134b7f]/40"
            >
              <h2 className="text-base font-semibold text-slate-900">Support tickets</h2>
              <p className="mt-1 text-sm text-slate-500">
                See tickets assigned to you, the branch queue, and closed tickets
              </p>
            </Link>
          )}

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
            Use Visitor check-in for walk-ins (host optional). For courier mail, open Find client →
            company → Incoming mail to photo and email the client.
          </p>
        </div>
      )}
    </div>
  );
}
