import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  listPayments,
  getCompanyPaymentHistory,
  resendPaymentLink,
  type AdminPayment,
  type PaymentsListResponse,
  type CompanyPaymentHistory,
} from '../services/admin';
import Badge from '../components/Badge';
import MetricCard from '../components/MetricCard';
import Modal from '../components/Modal';
import { TrendingUp, Calendar, Clock, XCircle, ExternalLink, Mail, Search } from 'lucide-react';

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

export default function AdminPayments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [pagination, setPagination] = useState<PaymentsListResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyHistory, setCompanyHistory] = useState<CompanyPaymentHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resendingLinkId, setResendingLinkId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'CREATED' | 'PAID' | 'FAILED' | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    revenueThisMonth: 0,
    pendingPayments: 0,
    failedPayments: 0,
  });

  const loadPayments = async () => {
    setError(null);
    setLoading(true);
    try {
      const fromDateObj = fromDate ? new Date(fromDate).toISOString() : undefined;
      const toDateObj = toDate ? new Date(toDate).toISOString() : undefined;

      const result = await listPayments({
        status: statusFilter || undefined,
        fromDate: fromDateObj,
        toDate: toDateObj,
        page: currentPage,
        limit: 50,
      });

      let filtered = result.data;

      // Client-side search by company name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((p) => p.companyName.toLowerCase().includes(query));
      }

      setPayments(filtered);
      setPagination(result.pagination);

      // Calculate summary stats from all payments (not just filtered)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalRevenue = result.data
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const revenueThisMonth = result.data
        .filter((p) => {
          if (p.status !== 'PAID' || !p.paidAt) return false;
          const paidDate = new Date(p.paidAt);
          return paidDate >= startOfMonth;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const pendingPayments = result.data.filter((p) => p.status === 'CREATED').length;
      const failedPayments = result.data.filter((p) => p.status === 'FAILED').length;

      setSummaryStats({
        totalRevenue,
        revenueThisMonth,
        pendingPayments,
        failedPayments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      setPayments([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [statusFilter, fromDate, toDate, currentPage]);

  const handleViewCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setHistoryLoading(true);
    try {
      const history = await getCompanyPaymentHistory(companyId);
      setCompanyHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
      setCompanyHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleResendLink = async (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Resend payment link to company?')) return;
    setResendingLinkId(paymentId);
    try {
      await resendPaymentLink(paymentId);
      alert('Payment link sent successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend payment link');
    } finally {
      setResendingLinkId(null);
    }
  };

  const handleCloseModal = () => {
    setSelectedCompanyId(null);
    setCompanyHistory(null);
  };

  if (loading && !pagination) {
    return (
      <div>
        <h1>Payment Dashboard</h1>
        <p>Loading payments…</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/admin/dashboard">Admin Dashboard</Link>
        {' · '}
        <Link to="/admin/payments">Payments</Link>
        {' · '}
        <Link to="/admin/audit-log">Audit log</Link>
      </div>
      <h1>Payment Dashboard</h1>

      {/* Summary Cards */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2>Summary</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(summaryStats.totalRevenue)}
            icon={TrendingUp}
            bgColor="bg-success/10"
            iconColor="text-success"
          />
          <MetricCard
            title="Revenue This Month"
            value={formatCurrency(summaryStats.revenueThisMonth)}
            icon={Calendar}
            bgColor="bg-primary/10"
            iconColor="text-primary"
          />
          <MetricCard
            title="Pending Payments"
            value={summaryStats.pendingPayments}
            icon={Clock}
            bgColor="bg-accent/10"
            iconColor="text-accent"
          />
          <MetricCard
            title="Failed Payments"
            value={summaryStats.failedPayments}
            icon={XCircle}
            bgColor="bg-error/10"
            iconColor="text-error"
          />
        </div>
      </section>

      {/* Filters */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Payments</h2>
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded border border-border px-3 py-2 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setCurrentPage(1);
            }}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="CREATED">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </select>
          <input
            type="date"
            placeholder="From Date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border border-border px-3 py-2 text-sm"
          />
          <input
            type="date"
            placeholder="To Date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border border-border px-3 py-2 text-sm"
          />
          {(statusFilter || fromDate || toDate || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setFromDate('');
                setToDate('');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="rounded border border-border bg-white px-3 py-2 text-sm text-text hover:bg-background"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      {/* Payments Table */}
      <section style={{ marginTop: '1.5rem' }}>
        {error && <p style={{ color: 'crimson', marginBottom: '1rem' }}>{error}</p>}
        {payments.length === 0 ? (
          <p>No payments found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Company Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Amount</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Paid Date</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Payment Link</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      style={{ borderBottom: '1px solid #ddd' }}
                      className="transition-colors hover:bg-background"
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => handleViewCompany(payment.companyId)}
                          className="text-left font-medium text-primary hover:underline"
                        >
                          {payment.companyName}
                        </button>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <Badge variant={paymentStatusVariant(payment.status)}>
                          {paymentStatusLabel(payment.status)}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{formatDate(payment.paidAt)}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {payment.paymentLink ? (
                          <a
                            href={payment.paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open Link
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/companies/${payment.companyId}`)}
                            className="rounded border border-border bg-white px-2 py-1 text-xs text-text hover:bg-background"
                          >
                            View Company
                          </button>
                          {payment.status === 'CREATED' && payment.paymentLink && (
                            <button
                              type="button"
                              onClick={(e) => handleResendLink(payment.id, e)}
                              disabled={resendingLinkId === payment.id}
                              className="inline-flex items-center gap-1 rounded border border-primary bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                            >
                              <Mail className="h-3 w-3" />
                              {resendingLinkId === payment.id ? 'Sending...' : 'Resend Link'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded border border-border bg-white px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="rounded border border-border bg-white px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Payment History Modal */}
      {selectedCompanyId && (
        <Modal isOpen={true} onClose={handleCloseModal} title="Payment History" size="lg">
          {historyLoading ? (
            <p>Loading payment history…</p>
          ) : companyHistory ? (
            <div>
              <h3 className="mb-4 text-lg font-semibold">{companyHistory.companyName}</h3>
              {companyHistory.payments.length === 0 ? (
                <p>No payment history found.</p>
              ) : (
                <div className="space-y-3">
                  {companyHistory.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-lg border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={paymentStatusVariant(payment.status)}>
                              {paymentStatusLabel(payment.status)}
                            </Badge>
                            <span className="text-lg font-semibold">
                              {formatCurrency(payment.amount, payment.currency)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            Created: {formatDate(payment.createdAt)}
                          </p>
                          {payment.paidAt && (
                            <p className="text-sm text-muted">Paid: {formatDate(payment.paidAt)}</p>
                          )}
                          {payment.providerPaymentId && (
                            <p className="text-xs text-muted">
                              Provider ID: {payment.providerPaymentId}
                            </p>
                          )}
                        </div>
                        {payment.paymentLink && (
                          <a
                            href={payment.paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Link
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p>Failed to load payment history.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
