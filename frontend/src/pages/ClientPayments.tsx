import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyPayments, type ClientPayment } from '../services/payments';
import Badge from '../components/Badge';
import { CreditCard, ExternalLink, CheckCircle, Clock, XCircle, Receipt } from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function paymentStatusVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'PAID') return 'approved';
  if (status === 'FAILED') return 'rejected';
  return 'pending';
}

function paymentStatusLabel(status: string): string {
  if (status === 'PAID') return 'Paid';
  if (status === 'FAILED') return 'Failed';
  return 'Pending';
}

function PaymentStatusIcon({ status }: { status: string }) {
  if (status === 'PAID') return <CheckCircle className="h-5 w-5 text-success" />;
  if (status === 'FAILED') return <XCircle className="h-5 w-5 text-error" />;
  return <Clock className="h-5 w-5 text-accent" />;
}

export default function ClientPayments() {
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyPayments();
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1>Payments</h1>
        <p>Loading payments…</p>
      </div>
    );
  }

  const pendingPayments = payments.filter((p) => p.status === 'CREATED');
  const paidPayments = payments.filter((p) => p.status === 'PAID');
  const failedPayments = payments.filter((p) => p.status === 'FAILED');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>Payments</h1>
        <div className="flex gap-4">
          <Link to="/client/invoices" className="inline-flex items-center gap-1 text-primary hover:text-accent">
            <Receipt className="h-4 w-4" />
            View Invoices
          </Link>
          <Link to="/dashboard" className="text-primary hover:text-accent">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error bg-error/10 p-4 text-error">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Pending</p>
              <p className="mt-1 text-2xl font-bold">{pendingPayments.length}</p>
            </div>
            <Clock className="h-8 w-8 text-accent" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Paid</p>
              <p className="mt-1 text-2xl font-bold">{paidPayments.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Failed</p>
              <p className="mt-1 text-2xl font-bold">{failedPayments.length}</p>
            </div>
            <XCircle className="h-8 w-8 text-error" />
          </div>
        </div>
      </div>

      {/* Payment History */}
      <section>
        <h2 className="mb-4">Payment History</h2>
        {payments.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-muted">No payment history available.</p>
            <p className="mt-2 text-sm text-muted">
              Payment records will appear here once payments are created.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <PaymentStatusIcon status={payment.status} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge variant={paymentStatusVariant(payment.status)}>
                        {paymentStatusLabel(payment.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                      <span>Created: {formatDate(payment.createdAt)}</span>
                      {payment.paidAt && <span>Paid: {formatDate(payment.paidAt)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {payment.status === 'CREATED' && payment.paymentLink && (
                    <a
                      href={payment.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Pay Now
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
