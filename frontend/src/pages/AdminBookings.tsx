import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getBookingStats,
  getRevenueByDate,
  listBookings,
  getLocations,
  type BookingListItem,
  type BookingStats,
  type RevenueByDate,
} from '../services/admin-bookings';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Calendar, Search, Download, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function bookingStatusVariant(status: string): 'confirmed' | 'pending' | 'cancelled' {
  const u = (status || '').toUpperCase();
  if (u === 'CONFIRMED') return 'confirmed';
  if (u === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function StatusBadge({ status }: { status: string }) {
  const variant = bookingStatusVariant(status);
  const classes = {
    confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-sm font-medium',
        classes[variant]
      )}
    >
      {status}
    </span>
  );
}

function exportToCSV(data: BookingListItem[]) {
  const headers = [
    'Date',
    'Location',
    'Resource',
    'Time Slot',
    'Quantity',
    'Customer Name',
    'Phone',
    'Amount',
    'Status',
    'Created At',
  ];
  const rows = data.map((b) => [
    formatDate(b.date),
    b.locationName,
    b.resourceType,
    b.timeSlot ?? '',
    String(b.quantity),
    b.name,
    b.phone ?? '',
    String(b.amountPaid),
    b.status,
    formatDateTime(b.createdAt),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join(
    '\n'
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 15;
const REFRESH_INTERVAL_MS = 60_000;

export default function AdminBookings() {
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueByDate[]>([]);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locationFilter, setLocationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(
    async (overrides?: { page?: number }) => {
      const effectivePage = overrides?.page ?? page;
      setError(null);
      setLoading(true);
      try {
        const [statsRes, revenueRes, bookingsRes, locationsRes] = await Promise.all([
          getBookingStats(),
          getRevenueByDate('7days'),
          listBookings({
            page: effectivePage,
            limit: PAGE_SIZE,
            locationId: locationFilter || undefined,
            date: dateFilter || undefined,
            status: statusFilter || undefined,
            search: searchQuery.trim() || undefined,
          }),
          getLocations(),
        ]);

      setStats(statsRes);
      setRevenueData(revenueRes);
      setBookings(bookingsRes.data);
      setTotal(bookingsRes.total);
      setTotalPages(bookingsRes.totalPages);
      setLocations((locationsRes as { id: string; name: string }[]).map((l) => ({ id: l.id, name: l.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setStats(null);
      setRevenueData([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
    },
    [page, locationFilter, dateFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const t = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
    loadData({ page: 1 });
  };

  const handleClearFilters = () => {
    setLocationFilter('');
    setDateFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setPage(1);
  };

  const hasFilters = locationFilter || dateFilter || statusFilter || searchQuery;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link to="/admin/dashboard" className="hover:text-primary">
            Admin Dashboard
          </Link>
          <span>·</span>
          <Link to="/admin/payments" className="hover:text-primary">
            Payments
          </Link>
          <span>·</span>
          <span className="text-text">Bookings</span>
        </div>

        <h1 className="mb-8 text-2xl font-bold text-text">Booking Monitor</h1>

        {/* Stats Cards */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats ? (
            <>
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-muted">Today Revenue</p>
                <p className="mt-1 text-3xl font-bold text-text">{formatCurrency(stats.todayRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-muted">Today Bookings</p>
                <p className="mt-1 text-3xl font-bold text-text">{stats.todayBookings}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-muted">Occupancy %</p>
                <p className="mt-1 text-3xl font-bold text-text">{stats.occupancyPercent}%</p>
              </div>
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-muted">Total Revenue</p>
                <p className="mt-1 text-3xl font-bold text-text">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </>
          ) : loading && !bookings.length ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <div className="h-4 w-24 animate-pulse rounded bg-muted/30" />
                <div className="mt-2 h-9 w-32 animate-pulse rounded bg-muted/30" />
              </div>
            ))
          ) : (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-muted">—</p>
                <p className="mt-1 text-3xl font-bold text-text">—</p>
              </div>
            ))
          )}
        </section>

        {/* Revenue Chart */}
        <section className="mb-10 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-text">Revenue (Last 7 Days)</h2>
          <div className="h-64 w-full">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={(label) => formatDate(label)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#134b7f"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No revenue data</div>
            )}
          </div>
        </section>

        {/* Filters */}
        <section className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-3 text-sm"
              />
            </div>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm hover:bg-background"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Table Section */}
        <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/5 px-4 py-3">
            <h2 className="text-lg font-semibold text-text">Bookings</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => exportToCSV(bookings)}
                disabled={bookings.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Time Slot
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && bookings.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-5 w-full animate-pulse rounded bg-muted/30" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-muted">
                      <Calendar className="mx-auto mb-2 h-12 w-12 opacity-40" />
                      <p className="font-medium">No bookings found</p>
                      <p className="mt-1 text-sm">Try adjusting filters or dates</p>
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-border transition-colors hover:bg-muted/10"
                    >
                      <td className="px-4 py-3 text-sm">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 text-sm">{b.locationName}</td>
                      <td className="px-4 py-3 text-sm">{b.resourceType}</td>
                      <td className="px-4 py-3 text-sm">{b.timeSlot ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{b.quantity}</td>
                      <td className="px-4 py-3 text-sm font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-sm">{b.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(b.amountPaid)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDateTime(b.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-3">
              <p className="text-sm text-muted">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:enabled:bg-background"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:enabled:bg-background"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
