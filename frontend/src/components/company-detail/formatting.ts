export function formatCompanyDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function documentStatusVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

export function documentStatusLabel(status: string): string {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'UPLOADED' || status === 'REVIEW_PENDING') return 'Pending review';
  if (status === 'PENDING_WITH_CLIENT') return 'Pending with client';
  if (status === 'PENDING') return 'Pending';
  return status;
}

/** Doc is awaiting admin action or was sent back to client (admin can change decision). */
export function isReviewableDocStatus(status: string): boolean {
  return status === 'REVIEW_PENDING' || status === 'PENDING_WITH_CLIENT';
}
