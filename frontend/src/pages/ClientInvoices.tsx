import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyInvoices, downloadMyInvoice, type ClientInvoice } from '../services/invoices';
import { Download, FileText } from 'lucide-react';

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

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
  }, [currentPage]);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyInvoices({
        page: currentPage,
        limit: 20,
      });
      setInvoices(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(invoiceId: string) {
    try {
      const { downloadUrl } = await downloadMyInvoice(invoiceId);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download invoice');
    }
  }

  if (loading) {
    return (
      <div>
        <h1>My Invoices</h1>
        <p>Loading invoices…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>My Invoices</h1>
        <Link to="/dashboard" className="text-primary hover:text-accent">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error bg-error/10 p-4 text-error">
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-8 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-muted" />
          <p className="text-muted">No invoices available yet.</p>
          <p className="mt-2 text-sm text-muted">
            Invoices will appear here after successful payments.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted" />
                    <div>
                      <h3 className="font-semibold text-text">{invoice.invoiceNumber}</h3>
                      <p className="text-sm text-muted">
                        {formatDate(invoice.createdAt)} · {formatCurrency(invoice.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted">
                    <span>Amount: {formatCurrency(invoice.amount)}</span>
                    <span>GST: {formatCurrency(invoice.gstAmount)}</span>
                    {invoice.payment?.providerPaymentId && (
                      <span>Payment ID: {invoice.payment.providerPaymentId}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(invoice.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
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
    </div>
  );
}
