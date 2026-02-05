import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listAuditLogs, type AuditLogEntry } from '../services/admin';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

/**
 * Map audit log entry to a display label for "recent actions" (document approved/rejected, company activated).
 * Returns null if the action should be hidden from this read-only view.
 */
function getActionLabel(entry: AuditLogEntry): string | null {
  if (entry.action === 'REVIEW_DOCUMENT' && entry.changes && typeof entry.changes === 'object' && 'status' in entry.changes) {
    const status = (entry.changes as { status?: { after?: string } }).status?.after;
    if (status === 'VERIFIED') return 'Document approved';
    if (status === 'REJECTED') return 'Document rejected';
  }
  if (entry.action === 'UPDATE_STATUS' || entry.action === 'UPDATE_COMPANY_STATUS') {
    const changes = entry.changes as { status?: { after?: string }; stage?: { after?: string } } | undefined;
    const after = changes?.stage?.after ?? changes?.status?.after;
    if (after === 'ACTIVE' || after === 'COMPLETED') return 'Company activated';
  }
  return null;
}

function getRelevantEntries(entries: AuditLogEntry[]): { entry: AuditLogEntry; label: string }[] {
  const result: { entry: AuditLogEntry; label: string }[] = [];
  for (const entry of entries) {
    const label = getActionLabel(entry);
    if (label) result.push({ entry, label });
  }
  return result;
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    listAuditLogs()
      .then((data) => {
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayList = getRelevantEntries(entries);

  if (loading) {
    return (
      <div>
        <h1>Audit log</h1>
        <p style={{ marginTop: '1rem' }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Audit log</h1>
        <p style={{ color: 'crimson', marginTop: '1rem' }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/admin/dashboard">← Back to dashboard</Link>
      </div>

      <h1>Audit log</h1>
      <p style={{ color: '#666', marginTop: '0.5rem' }}>
        Read-only view of recent actions. Document approvals/rejections and company activations.
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        {displayList.length === 0 ? (
          <p style={{ color: '#666' }}>No relevant audit entries yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Timestamp</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Action</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Admin</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Context</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(({ entry, label }) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{label}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {entry.user?.email ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {entry.clientProfile?.companyName && (
                      <Link to={`/admin/companies/${entry.clientProfile.id}`}>
                        {entry.clientProfile.companyName}
                      </Link>
                    )}
                    {entry.document?.fileName && (
                      <span style={{ marginLeft: entry.clientProfile ? '0.5rem' : 0 }}>
                        {entry.document.fileName}
                      </span>
                    )}
                    {!entry.clientProfile && !entry.document && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
