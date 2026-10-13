import { useEffect, useState } from 'react';
import {
  getMobileLocations,
  getMobileVendors,
  updateCompany,
  type AdminCompany,
  type UpdateCompanyInput,
} from '../../services/admin';
import {
  LEAD_SOURCE_OPTIONS,
  MEMBERSHIP_TYPE_OPTIONS,
  OFFICE_TYPE_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
  leadSourceToChannel,
  toDateInputValue,
} from '../../constants/clientOpsOptions';

const fieldClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:opacity-60';

type Props = {
  company: AdminCompany;
  onSaved: (company: AdminCompany) => void;
};

function companyToForm(company: AdminCompany) {
  return {
    companyName: company.companyName ?? '',
    contactEmail: company.contactEmail ?? '',
    contactPhone: company.contactPhone ?? '',
    taxId: company.taxId ?? '',
    address: company.address ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    zipCode: company.zipCode ?? '',
    country: company.country ?? '',
    notes: company.notes ?? '',
    contactPersonName: company.contactPersonName ?? '',
    contactPersonTitle: company.contactPersonTitle ?? '',
    contactPersonPhone: company.contactPersonPhone ?? '',
    gstNumber: company.gstNumber ?? '',
    externalBookingId: company.externalBookingId ?? '',
    membershipType: company.membershipType ?? '',
    officeType: company.officeType ?? '',
    leadSource: company.leadSource ?? '',
    contractMonths: company.contractMonths != null ? String(company.contractMonths) : '',
    aggregatorName: company.aggregatorName ?? '',
    locationId: company.locationId ?? company.location?.id ?? '',
    vendorId: company.vendorId ?? company.vendor?.id ?? '',
    contractStartDate: toDateInputValue(company.contractStartDate),
    contractEndDate: toDateInputValue(company.contractEndDate),
    operationalStatus: company.operationalStatus ?? 'UNKNOWN',
  };
}

export default function CompanyProfileEditSection({ company, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => companyToForm(company));
  const [locations, setLocations] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setForm(companyToForm(company));
  }, [company, editing]);

  useEffect(() => {
    getMobileLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (!form.locationId) {
      setVendors([]);
      return;
    }
    getMobileVendors(form.locationId)
      .then(setVendors)
      .catch(() => setVendors([]));
  }, [form.locationId]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'locationId' ? { vendorId: '' } : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const channel = form.leadSource ? leadSourceToChannel(form.leadSource) : company.clientChannel;
    if (channel === 'AGGREGATOR' && !form.aggregatorName.trim()) {
      setError('Aggregator name is required when lead source is Aggregator.');
      return;
    }

    const payload: UpdateCompanyInput = {
      companyName: form.companyName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zipCode: form.zipCode.trim() || undefined,
      country: form.country.trim() || undefined,
      notes: form.notes.trim() || undefined,
      contactPersonName: form.contactPersonName.trim() || undefined,
      contactPersonTitle: form.contactPersonTitle.trim() || undefined,
      contactPersonPhone: form.contactPersonPhone.trim() || undefined,
      gstNumber: form.gstNumber.trim() || undefined,
      externalBookingId: form.externalBookingId.trim() || undefined,
      membershipType: form.membershipType.trim() || undefined,
      officeType: form.officeType.trim() || undefined,
      leadSource: form.leadSource.trim() || undefined,
      aggregatorName: form.aggregatorName.trim() || undefined,
      locationId: form.locationId || '',
      vendorId: form.vendorId || '',
      contractStartDate: form.contractStartDate || undefined,
      contractEndDate: form.contractEndDate || undefined,
      operationalStatus: form.operationalStatus as UpdateCompanyInput['operationalStatus'],
    };
    if (form.contractMonths) payload.contractMonths = Number(form.contractMonths);

    setSaving(true);
    try {
      const updated = await updateCompany(company.id, payload);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const showAggregatorName =
    (form.leadSource && leadSourceToChannel(form.leadSource) === 'AGGREGATOR') ||
    company.clientChannel === 'AGGREGATOR';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="mt-0 text-lg font-semibold text-slate-900">Client details</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md bg-sky-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-900"
          >
            Edit details
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setForm(companyToForm(company));
              setError(null);
            }}
            disabled={saving}
            className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Fields aligned with the Excel client export (company, contact, branch, agreement, GST, booking ID).
      </p>

      {!editing ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="Company name" value={company.companyName} />
          <Field label="Email" value={company.contactEmail} />
          <Field label="Phone" value={company.contactPhone} />
          <Field label="PAN" value={company.taxId} />
          <Field label="GST number" value={company.gstNumber} />
          <Field label="Contact person" value={company.contactPersonName} />
          <Field label="Title" value={company.contactPersonTitle} />
          <Field label="Contact #" value={company.contactPersonPhone} />
          <Field
            label="Branch"
            value={
              company.location
                ? `${company.location.code ? `${company.location.code} — ` : ''}${company.location.name}`
                : null
            }
          />
          <Field label="Vendor / aggregator sheet" value={company.vendor?.name ?? company.aggregatorName} />
          <Field label="Office type" value={company.officeType} />
          <Field label="Lead source" value={company.leadSource} />
          <Field label="Membership type" value={company.membershipType} />
          <Field label="Contract months" value={company.contractMonths} />
          <Field label="Agreement start" value={toDateInputValue(company.contractStartDate) || null} />
          <Field label="Agreement end" value={toDateInputValue(company.contractEndDate) || null} />
          <Field label="Booking ID" value={company.externalBookingId} />
          <Field label="Operational status" value={company.operationalStatus} />
          <Field label="Address" value={company.address} className="sm:col-span-2" />
          <Field label="City" value={company.city} />
          <Field
            label="State / ZIP / Country"
            value={[company.state, company.zipCode, company.country].filter(Boolean).join(', ') || null}
          />
          <Field label="Notes" value={company.notes} className="sm:col-span-2" />
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <FieldGroup title="Company & contact">
            <Input label="Company name *" name="companyName" value={form.companyName} onChange={handleChange} required />
            <Input label="Email *" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} required />
            <Input label="Phone number" name="contactPhone" value={form.contactPhone} onChange={handleChange} />
            <Input label="PAN no." name="taxId" value={form.taxId} onChange={handleChange} />
            <Input label="GST number" name="gstNumber" value={form.gstNumber} onChange={handleChange} />
          </FieldGroup>

          <FieldGroup title="Contact person (Excel: Title / First Name / Contact #)">
            <Input label="First name / contact name" name="contactPersonName" value={form.contactPersonName} onChange={handleChange} />
            <Input label="Title / position" name="contactPersonTitle" value={form.contactPersonTitle} onChange={handleChange} />
            <Input label="Contact #" name="contactPersonPhone" value={form.contactPersonPhone} onChange={handleChange} />
          </FieldGroup>

          <FieldGroup title="Branch & membership">
            <Select label="Branch location" name="locationId" value={form.locationId} onChange={handleChange}>
              <option value="">(none)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.code ? `${l.code} — ` : '') + l.name}
                </option>
              ))}
            </Select>
            <Select
              label="Vendor (sheet / partner)"
              name="vendorId"
              value={form.vendorId}
              onChange={handleChange}
              disabled={!form.locationId}
            >
              <option value="">(none)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
            <Select label="Office type" name="officeType" value={form.officeType} onChange={handleChange}>
              <option value="">(none)</option>
              {OFFICE_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
            <Select label="Lead source" name="leadSource" value={form.leadSource} onChange={handleChange}>
              <option value="">(none)</option>
              {LEAD_SOURCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
            {showAggregatorName && (
              <Input
                label="Aggregator name"
                name="aggregatorName"
                value={form.aggregatorName}
                onChange={handleChange}
              />
            )}
            <Select label="Membership type" name="membershipType" value={form.membershipType} onChange={handleChange}>
              <option value="">(none)</option>
              {MEMBERSHIP_TYPE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Input
              label="No. of months"
              name="contractMonths"
              type="number"
              min={1}
              max={600}
              value={form.contractMonths}
              onChange={handleChange}
            />
          </FieldGroup>

          <FieldGroup title="Agreement">
            <Input label="Agreement start date" name="contractStartDate" type="date" value={form.contractStartDate} onChange={handleChange} />
            <Input label="Agreement end date" name="contractEndDate" type="date" value={form.contractEndDate} onChange={handleChange} />
            <Input label="Booking ID" name="externalBookingId" value={form.externalBookingId} onChange={handleChange} />
            <Select label="Operational status" name="operationalStatus" value={form.operationalStatus} onChange={handleChange}>
              {OPERATIONAL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup title="Address">
            <Input label="Address" name="address" value={form.address} onChange={handleChange} className="sm:col-span-2" />
            <Input label="Client city" name="city" value={form.city} onChange={handleChange} />
            <Input label="State" name="state" value={form.state} onChange={handleChange} />
            <Input label="ZIP" name="zipCode" value={form.zipCode} onChange={handleChange} />
            <Input label="Country" name="country" value={form.country} onChange={handleChange} />
          </FieldGroup>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className={fieldClass}
              disabled={saving}
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-800 px-4 py-2 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{display}</dd>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <input {...props} className={fieldClass} disabled={props.disabled} />
    </label>
  );
}

function Select({
  label,
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <select {...props} className={fieldClass} disabled={props.disabled}>
        {children}
      </select>
    </label>
  );
}
