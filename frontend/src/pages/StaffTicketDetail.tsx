import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TicketWorkspace from '../components/tickets/TicketWorkspace';
import {
  assignStaffTicket,
  attachStaffTicket,
  closeStaffTicket,
  commentStaffTicket,
  fetchTicketAttachmentUrl,
  getStaffTicket,
  listStaffColleagues,
  takeStaffTicket,
  type Colleague,
  type TicketDetail,
} from '../services/tickets';

async function fileToBase64(file: File): Promise<string> {
  const raw = await file.arrayBuffer();
  const bytes = new Uint8Array(raw);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export default function StaffTicketDetail() {
  const { id = '' } = useParams();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStaffTicket(id), listStaffColleagues()])
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

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ticket) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <TicketWorkspace
      ticket={ticket}
      colleagues={colleagues}
      backTo="/staff/tickets"
      allowReopen={false}
      onComment={async (body) => setTicket(await commentStaffTicket(id, body))}
      onTake={async () => setTicket(await takeStaffTicket(id))}
      onAssign={async (assigneeId, reason) => setTicket(await assignStaffTicket(id, assigneeId, reason))}
      onClose={async (notes) => setTicket(await closeStaffTicket(id, notes))}
      onUpload={async (file) => {
        if (file.size > 4 * 1024 * 1024) throw new Error('Attachment must be 4 MB or smaller');
        setTicket(await attachStaffTicket(id, file.name, await fileToBase64(file)));
      }}
      onOpenFile={async (attachmentId) => {
        const url = await fetchTicketAttachmentUrl('staff', id, attachmentId);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }}
    />
  );
}
