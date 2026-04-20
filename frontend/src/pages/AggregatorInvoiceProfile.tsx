import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMyInvoiceProfile,
  upsertMyInvoiceProfile,
  type AggregatorInvoiceProfile,
} from '../services/aggregatorProfile';
import { FileText, Save, CheckCircle2 } from 'lucide-react';

const inputClass =
  'block w-full rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

interface FormState {
  legalName: string;
  constitution: string;
  gstin: string;
  pan: string;
  registeredAddress: string;
}

const EMPTY: FormState = {
  legalName: '',
  constitution: '',
  gstin: '',
  pan: '',
  registeredAddress: '',
};

function toForm(profile: AggregatorInvoiceProfile | null): FormState {
  if (!profile) return EMPTY;
  return {
    legalName: profile.legalName ?? '',
    constitution: profile.constitution ?? '',
    gstin: profile.gstin ?? '',
    pan: profile.pan ?? '',
    registeredAddress: profile.registeredAddress ?? '',
  };
}

export default function AggregatorInvoiceProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const profile = await getMyInvoiceProfile();
        if (cancelled) return;
        setForm(toForm(profile));
        setHasProfile(!!profile);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load invoice profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.legalName.trim()) {
      setError('Legal name is required.');
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertMyInvoiceProfile({
        legalName: form.legalName.trim(),
        constitution: form.constitution.trim() || null,
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim() || null,
        registeredAddress: form.registeredAddress.trim() || null,
      });
      setForm(toForm(saved));
      setHasProfile(true);
      setSuccess('Invoicing details saved. These will auto-fill on every new client you register.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoicing details');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg p-2 bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Invoicing</h1>
            <p className="text-sm text-slate-500 mt-1">
              Save your Invoice-To entity once. We auto-fill these details on every new client
              you register; you can still override them for a specific booking.
            </p>
          </div>
        </div>
        {hasProfile && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 mt-6">Loading…</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="legalName" className="block text-sm font-medium text-slate-700 mb-1">
              Company legal name <span className="text-red-600">*</span>
            </label>
            <input
              id="legalName"
              name="legalName"
              type="text"
              value={form.legalName}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Instaspaces Realtech Private Limited"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="constitution" className="block text-sm font-medium text-slate-700 mb-1">
              Constitution
            </label>
            <input
              id="constitution"
              name="constitution"
              type="text"
              value={form.constitution}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Private Limited Company"
              disabled={saving}
              list="constitution-suggestions"
            />
            <datalist id="constitution-suggestions">
              <option value="Private Limited Company" />
              <option value="Public Limited Company" />
              <option value="Limited Liability Partnership" />
              <option value="Partnership" />
              <option value="Proprietorship" />
              <option value="Individual" />
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gstin" className="block text-sm font-medium text-slate-700 mb-1">
                GSTIN
              </label>
              <input
                id="gstin"
                name="gstin"
                type="text"
                value={form.gstin}
                onChange={handleChange}
                className={inputClass}
                placeholder="15-character GSTIN"
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="pan" className="block text-sm font-medium text-slate-700 mb-1">
                PAN
              </label>
              <input
                id="pan"
                name="pan"
                type="text"
                value={form.pan}
                onChange={handleChange}
                className={inputClass}
                placeholder="AAAAA9999A"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="registeredAddress"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Registered address
            </label>
            <textarea
              id="registeredAddress"
              name="registeredAddress"
              value={form.registeredAddress}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              placeholder="Full registered office address"
              disabled={saving}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : hasProfile ? 'Save changes' : 'Save invoicing details'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/aggregator/dashboard')}
              disabled={saving}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
