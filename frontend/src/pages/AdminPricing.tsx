import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getLocationsWithResources,
  updateResourcePricing,
  applyCampaignPricing,
  type LocationWithResources,
  type ResourceWithPricing,
} from '../services/admin-pricing';
import Toast from '../components/Toast';
import { RefreshCw, Pencil, Check, X } from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function resourceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CONFERENCE_ROOM: 'Conference Room',
    DISCUSSION_ROOM: 'Discussion Room',
    DAY_PASS_DESK: 'Day Pass Desk',
  };
  return map[type] ?? type;
}

function isDesk(type: string): boolean {
  return type === 'DAY_PASS_DESK';
}

export default function AdminPricing() {
  const [locations, setLocations] = useState<LocationWithResources[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [conferenceHourly, setConferenceHourly] = useState<number>(1200);
  const [discussionHourly, setDiscussionHourly] = useState<number>(800);
  const [dayPassPrice, setDayPassPrice] = useState<number>(699);

  const [applying, setApplying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHourly, setEditHourly] = useState<string>('');
  const [editDay, setEditDay] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getLocationsWithResources();
      setLocations(data);

      // Pre-fill campaign form from first resource of each type
      const allResources = data.flatMap((loc) => loc.resources);
      const conf = allResources.find((r) => r.type === 'CONFERENCE_ROOM');
      const disc = allResources.find((r) => r.type === 'DISCUSSION_ROOM');
      const desk = allResources.find((r) => r.type === 'DAY_PASS_DESK');
      if (conf?.pricing?.hourlyPrice != null) setConferenceHourly(conf.pricing.hourlyPrice);
      if (disc?.pricing?.hourlyPrice != null) setDiscussionHourly(disc.pricing.hourlyPrice);
      if (desk?.pricing?.dayPrice != null) setDayPassPrice(desk.pricing.dayPrice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(msg);
  }, []);

  const handleApplyCampaign = async () => {
    setApplying(true);
    try {
      const result = await applyCampaignPricing({
        conferenceHourly,
        discussionHourly,
        dayPassPrice,
      });
      showToast(`Updated pricing for ${result.updated} resources.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply campaign pricing', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleStartEdit = (res: ResourceWithPricing) => {
    setEditingId(res.id);
    setEditHourly(res.pricing?.hourlyPrice != null ? String(res.pricing.hourlyPrice) : '');
    setEditDay(res.pricing?.dayPrice != null ? String(res.pricing.dayPrice) : '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditHourly('');
    setEditDay('');
  };

  const handleSaveEdit = async (res: ResourceWithPricing) => {
    setSavingId(res.id);
    try {
      const hourly = editHourly.trim() ? parseFloat(editHourly) : null;
      const day = editDay.trim() ? parseFloat(editDay) : null;
      if (isDesk(res.type)) {
        await updateResourcePricing(res.id, { hourlyPrice: null, dayPrice: day });
      } else {
        await updateResourcePricing(res.id, { hourlyPrice: hourly, dayPrice: null });
      }
      showToast('Pricing updated.', 'success');
      await loadData();
      setEditingId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update pricing', 'error');
    } finally {
      setSavingId(null);
    }
  };

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
          <Link to="/admin/bookings" className="hover:text-primary">
            Bookings
          </Link>
          <span>·</span>
          <span className="text-text">Pricing</span>
          <span>·</span>
          <Link to="/admin/invoices" className="hover:text-primary">
            Invoices
          </Link>
          <span>·</span>
          <Link to="/admin/audit-log" className="hover:text-primary">
            Audit log
          </Link>
        </div>

        <h1 className="mb-8 text-2xl font-bold text-text">Campaign Pricing</h1>

        {/* Campaign form */}
        <section className="mb-10 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text">Apply Campaign Prices to All Resources</h2>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Conference Room (₹/hr)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={conferenceHourly}
                onChange={(e) => setConferenceHourly(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Discussion Room (₹/hr)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={discussionHourly}
                onChange={(e) => setDiscussionHourly(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Day Pass Desk (₹/day)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={dayPassPrice}
                onChange={(e) => setDayPassPrice(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCampaign}
              disabled={applying}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {applying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                'Apply to all'
              )}
            </button>
          </div>
        </section>

        {/* Resources by location */}
        <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/5 px-4 py-3">
            <h2 className="text-lg font-semibold text-text">Resources by Location</h2>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {error && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {loading && locations.length === 0 ? (
            <div className="p-8">
              <div className="h-6 w-48 animate-pulse rounded bg-muted/30" />
              <div className="mt-4 h-32 w-full animate-pulse rounded bg-muted/30" />
            </div>
          ) : locations.length === 0 ? (
            <div className="p-16 text-center text-muted">
              <p className="font-medium">No locations or resources found.</p>
              <p className="mt-1 text-sm">Add locations and resources to configure pricing.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {locations.map((loc) => (
                <div key={loc.id} className="p-4">
                  <h3 className="mb-3 font-medium text-text">{loc.name}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            Resource
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            Capacity
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            Hourly
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            Day Price
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loc.resources.map((res) => {
                          const isEditing = editingId === res.id;
                          const isSaving = savingId === res.id;
                          const isDeskType = isDesk(res.type);

                          return (
                            <tr key={res.id} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-sm">{resourceTypeLabel(res.type)}</td>
                              <td className="px-3 py-2 text-sm">{res.capacity}</td>
                              <td className="px-3 py-2 text-sm">
                                {isEditing ? (
                                  isDeskType ? (
                                    '—'
                                  ) : (
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={editHourly}
                                      onChange={(e) => setEditHourly(e.target.value)}
                                      className="w-24 rounded border border-border px-2 py-1 text-sm"
                                    />
                                  )
                                ) : (
                                  res.pricing?.hourlyPrice != null
                                    ? formatCurrency(res.pricing.hourlyPrice)
                                    : '—'
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm">
                                {isEditing ? (
                                  isDeskType ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={editDay}
                                      onChange={(e) => setEditDay(e.target.value)}
                                      className="w-24 rounded border border-border px-2 py-1 text-sm"
                                    />
                                  ) : (
                                    '—'
                                  )
                                ) : (
                                  res.pricing?.dayPrice != null
                                    ? formatCurrency(res.pricing.dayPrice)
                                    : '—'
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(res)}
                                      disabled={isSaving}
                                      className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                      title="Save"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      disabled={isSaving}
                                      className="rounded p-1.5 text-muted hover:bg-muted/30 disabled:opacity-50"
                                      title="Cancel"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(res)}
                                    className="rounded p-1.5 text-muted hover:bg-muted/30"
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <Toast
          key={toast}
          message={toast}
          type={toastType}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
