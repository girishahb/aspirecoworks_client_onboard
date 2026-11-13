import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TicketWorkspace from '../components/tickets/TicketWorkspace';
import { getCurrentUser } from '../services/auth';
import {
  assignAdminTicket,
  attachAdminTicket,
  closeAdminTicket,
  commentAdminTicket,
  fetchTicketAttachmentUrl,
  getAdminTicket,
  listAdminColleagues,
  reopenAdminTicket,
  takeAdminTicket,
  type Colleague,
  type TicketDetail,
} from '../services/tickets';

async function fileToBase64(file: File): Promise<string> {
  const raw = await file.arrayBuffer();
  let binary = '';
  new Uint8Array(raw).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export default function AdminTicketDetail() {
  const { id = '' } = useParams();
  const allowReopen = getCurrentUser()?.role === 'SUPER_ADMIN';
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminTicket(id), listAdminColleagues()])
      .then(([next, people]) => {
        if (cancelled) return;
        setTicket(next);
        setColleagues(people);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open ticket');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!ticket) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="text-slate-900">
      <TicketWorkspace
        ticket={ticket}
        colleagues={colleagues}
        backTo="/admin/tickets"
        allowReopen={allowReopen}
        onComment={async (body) => setTicket(await commentAdminTicket(id, body))}
        onTake={async () => setTicket(await takeAdminTicket(id))}
        onAssign={async (assigneeId, reason) => setTicket(await assignAdminTicket(id, assigneeId, reason))}
        onClose={async (notes) => setTicket(await closeAdminTicket(id, notes))}
        onReopen={async (reason) => setTicket(await reopenAdminTicket(id, reason))}
        onUpload={async (file) => {
          if (file.size > 4 * 1024 * 1024) throw new Error('Attachment must be 4 MB or smaller');
          setTicket(await attachAdminTicket(id, file.name, await fileToBase64(file)));
        }}
        onOpenFile={async (attachmentId) => {
          const url = await fetchTicketAttachmentUrl('admin', id, attachmentId);
          window.open(url, '_blank', 'noopener');
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }}
      />
    </div>
  );
}
