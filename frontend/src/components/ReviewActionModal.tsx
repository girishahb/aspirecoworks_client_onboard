import { useState, useCallback } from 'react';
import { apiPatch } from '../api/client';
import type { ReviewDocumentRequest } from '../api/types';

export type ReviewActionType = 'APPROVE' | 'REJECT';

interface ReviewActionModalProps {
  documentId: string;
  actionType: ReviewActionType;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewActionModal({
  documentId,
  actionType,
  onClose,
  onSuccess,
}: ReviewActionModalProps) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (actionType === 'REJECT' && !remarks.trim()) {
        setError('Remarks are required when rejecting.');
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const body: ReviewDocumentRequest =
          actionType === 'APPROVE'
            ? { status: 'VERIFIED' }
            : { status: 'REJECTED', rejectionReason: remarks.trim() };

        await apiPatch<unknown>(`/documents/${documentId}/review`, body);
        onSuccess?.();
        onClose();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [documentId, actionType, remarks, onClose, onSuccess],
  );

  const title = actionType === 'APPROVE' ? 'Approve document' : 'Reject document';
  const submitLabel = actionType === 'APPROVE' ? 'Approve' : 'Reject';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-6 py-4">
          <h2 id="review-modal-title" className="text-lg font-semibold text-stone-900">
            {title}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {actionType === 'REJECT' && (
            <div className="mb-4">
              <label
                htmlFor="review-remarks"
                className="block text-sm font-medium text-stone-700"
              >
                Remarks <span className="text-red-600">*</span>
              </label>
              <textarea
                id="review-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                placeholder="Reason for rejection"
                disabled={loading}
                required={actionType === 'REJECT'}
              />
            </div>
          )}

          {error && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (actionType === 'REJECT' && !remarks.trim())}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
