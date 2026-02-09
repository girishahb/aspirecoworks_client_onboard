import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices, downloadInvoice, type AdminInvoice, type InvoicesListResponse } from '../services/admin';
import { Download, FileText, Search } from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [pagination, setPagination] = useState<InvoicesListResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadInvoices();
  }, [companyFilter, currentPage]);

  async function loadInvoices() {
    setError(null);
    setLoading(true);
    try {
      const result = await listInvoices({
        companyId: companyFilter || undefined,
        page: currentPage,
        limit: 50,
      });

      let filtered = result.data;

      // Client-side search by invoice number or company name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (inv) =>
            inv.invoiceNumber.toLowerCase().includes(query) ||
            inv.company?.companyName.toLowerCase().includes(query),
        );
      }

      setInvoices(filtered);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      setInvoices([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(invoiceId: string) {
    try {
      const { downloadUrl } = await downloadInvoice(invoiceId);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download invoice');
    }
  }

  if (loading && !pagination) {
    return (
      <div>
        <h1>Invoices</h1>
        <p>Loading invoices…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>Invoices</h1>
        <div>
          <Link to="/admin/dashboard">Admin Dashboard</Link>
          {' · '}
          <Link to="/admin/payments">Payments</Link>
          {' · '}
          <Link to="/admin/invoices">Invoices</Link>
          {' · '}
          <Link to="/admin/audit-log">Audit log</Link>
        </div>
      </div>

      {/* Filters */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by invoice number or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded border border-border px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Filter by company ID..."
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border border-border px-3 py-2 text-sm"
          />
          {(searchQuery || companyFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCompanyFilter('');
                setCurrentPage(1);
              }}
              className="rounded border border-border bg-white px-3 py-2 text-sm text-text hover:bg-background"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      {/* Invoices Table */}
      <section>
        {error && <p style={{ color: 'crimson', marginBottom: '1rem' }}>{error}</p>}
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-muted">No invoices found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Invoice #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">GST</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-border transition-colors hover:bg-background"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/companies/${invoice.companyId}`}
                          className="text-primary hover:underline"
                        >
                          {invoice.company?.companyName || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(invoice.amount)}</td>
                      <td className="px-4 py-3">{formatCurrency(invoice.gstAmount)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(invoice.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(invoice.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
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
    </div>
  );
}
