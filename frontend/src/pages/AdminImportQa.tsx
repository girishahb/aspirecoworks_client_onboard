import { useCallback, useEffect, useState } from 'react';
import {
  getImportQaSummary,
  getImportQaDateRows,
  getImportQaRuns,
  downloadImportQaFile,
  type ImportQaDateRow,
  type ImportQaSummaryResponse,
} from '../services/admin';

const FLAG_OPTIONS = [
  '',
  'DATE_PARSE_FAIL',
  'DATE_EMPTY',
  'DATE_SENTINEL',
  'DATE_OUTLIER',
  'DATE_RANGE_INVALID',
  'DATE_COERCED_SERIAL',
  'DATE_COERCED_TEXT',
  'DATE_OK',
];

export default function AdminImportQa() {
  const [runs, setRuns] = useState<string[]>([]);
  const [runId, setRunId] = useState<string>('');
  const [summary, setSummary] = useState<ImportQaSummaryResponse | null>(null);
  const [rows, setRows] = useState<ImportQaDateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [locationCode, setLocationCode] = useState('');
  const [sheet, setSheet] = useState('');
  const [flag, setFlag] = useState('');
  const [column, setColumn] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const runList = await getImportQaRuns();
      setRuns(runList.runs);
      const active = runId || runList.latest || runList.runs[0] || '';
      if (!runId && active) setRunId(active);
      if (!active) {
        setSummary(null);
        setRows([]);
        setTotal(0);
        setError('No migration QA run found. Run: npm run scripts:migrate-excel -- --qa-only');
        return;
      }
      const [sum, dateQa] = await Promise.all([
        getImportQaSummary(active),
        getImportQaDateRows({
          runId: active,
          locationCode: locationCode || undefined,
          sheet: sheet || undefined,
          flag: flag || undefined,
          column: column || undefined,
          q: q || undefined,
          limit,
          offset,
        }),
      ]);
      setSummary(sum);
      setRows(dateQa.rows);
      setTotal(dateQa.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load import QA');
    } finally {
      setLoading(false);
    }
  }, [runId, locationCode, sheet, flag, column, q, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload(file: string) {
    try {
      await downloadImportQaFile(file, runId || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  }

  const flagCounts = summary?.summary?.flagCounts ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Excel Import QA</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse date cleaning results from the one-time Aspire client workbook load.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm p-3" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Run</span>
          <select
            className="border rounded-md px-3 py-2 text-sm min-w-[220px]"
            value={runId}
            onChange={(e) => {
              setRunId(e.target.value);
              setOffset(0);
            }}
          >
            {runs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Location</span>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={locationCode}
            onChange={(e) => {
              setLocationCode(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All</option>
            <option value="Indiranagar_1">Indiranagar_1</option>
            <option value="Platinum">Platinum</option>
            <option value="Kormangala_1">Kormangala_1</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Flag</span>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={flag}
            onChange={(e) => {
              setFlag(e.target.value);
              setOffset(0);
            }}
          >
            {FLAG_OPTIONS.map((f) => (
              <option key={f || 'all'} value={f}>
                {f || 'All (issues first)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Sheet</span>
          <input
            className="border rounded-md px-3 py-2 text-sm"
            value={sheet}
            onChange={(e) => setSheet(e.target.value)}
            onBlur={() => setOffset(0)}
            placeholder="vendor sheet"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Column</span>
          <input
            className="border rounded-md px-3 py-2 text-sm"
            value={column}
            onChange={(e) => setColumn(e.target.value)}
            onBlur={() => setOffset(0)}
            placeholder="Agreement Start"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Search</span>
          <input
            className="border rounded-md px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setOffset(0)}
            placeholder="company / raw / cleaned"
          />
        </label>
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-slate-800 text-white text-sm"
          onClick={() => {
            setOffset(0);
            void load();
          }}
        >
          Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Mode</p>
            <p className="font-semibold">{summary.summary.mode}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Rows read</p>
            <p className="font-semibold">{summary.summary.rowsRead}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Would import / imported</p>
            <p className="font-semibold">
              {summary.summary.imported}
              {summary.summary.updated ? ` (+${summary.summary.updated} upd)` : ''}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Quarantined</p>
            <p className="font-semibold">{summary.summary.quarantined}</p>
          </div>
        </div>
      )}

      {Object.keys(flagCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(flagCounts).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setFlag(k);
                setOffset(0);
              }}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                flag === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700'
              }`}
            >
              {k}: {v as number}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['date_qa.csv', 'field_qa.csv', 'duplicates.csv', 'quarantine_index.csv', 'summary.json', 'distributions.json'].map(
          (f) => (
            <button
              key={f}
              type="button"
              className="text-sm text-teal-700 underline"
              onClick={() => void handleDownload(f)}
            >
              Download {f}
            </button>
          ),
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Loc</th>
              <th className="px-3 py-2">Sheet</th>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Column</th>
              <th className="px-3 py-2">Raw</th>
              <th className="px-3 py-2">Cleaned</th>
              <th className="px-3 py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.sheet}-${r.row}-${r.column}-${i}`} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{r.locationCode}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={r.sheet}>
                    {r.sheet}
                  </td>
                  <td className="px-3 py-2">{r.row}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.companyName}>
                    {r.companyName}
                  </td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={r.column}>
                    {r.column}
                  </td>
                  <td className="px-3 py-2 max-w-[120px] truncate font-mono text-xs" title={r.rawValue}>
                    {r.rawValue}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.cleaned || '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded ${
                        r.flag.includes('FAIL') || r.flag.includes('INVALID')
                          ? 'bg-red-100 text-red-800'
                          : r.flag.includes('EMPTY') || r.flag.includes('SENTINEL') || r.flag.includes('OUTLIER')
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {r.flag}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 border rounded disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Prev
          </button>
          <button
            type="button"
            className="px-3 py-1.5 border rounded disabled:opacity-40"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
