import { Eye, Download } from 'lucide-react';
import Badge from '../Badge';
import type { AdminCompany, AdminDocumentListItem } from '../../services/admin';
import {
  documentStatusLabel,
  documentStatusVariant,
  formatCompanyDate,
  isReviewableDocStatus,
} from './formatting';

type Props = {
  title: string;
  sectionDocs: AdminDocumentListItem[];
  company: AdminCompany;
  isAggregatorView: boolean;
  busyId: string | null;
  notifyDraftBusyId: string | null;
  onView: (docId: string, fileName: string) => void;
  onDownload: (docId: string) => void;
  onApprove: (docId: string) => void;
  onReject: (docId: string) => void;
  onMarkPendingWithClient: (docId: string) => void;
  onNotifyAgreementDraftShared: (documentId: string) => void;
};

export default function DocumentTableSection({
  title,
  sectionDocs,
  company,
  isAggregatorView,
  busyId,
  notifyDraftBusyId,
  onView,
  onDownload,
  onApprove,
  onReject,
  onMarkPendingWithClient,
  onNotifyAgreementDraftShared,
}: Props) {
  if (sectionDocs.length === 0) return null;

  const isAggregatorCompany = company?.clientChannel === 'AGGREGATOR';
  const notifyAllowedStages = new Set(['KYC_REVIEW', 'AGREEMENT_DRAFT_SHARED']);
  const notifyStageAllowed =
    !!company?.onboardingStage && notifyAllowedStages.has(company.onboardingStage);
  const latestAgreementDraftId =
    sectionDocs
      .filter((d) => d.documentType === 'AGREEMENT_DRAFT')
      .reduce<{ id: string; version: number } | null>((acc, d) => {
        const v = d.version ?? 0;
        if (!acc || v > acc.version) return { id: d.id, version: v };
        return acc;
      }, null)?.id ?? null;

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-base font-semibold text-slate-900">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="px-3 py-2 font-semibold text-slate-700">Document</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Type</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Status</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Timeline</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sectionDocs.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-200 last:border-0">
                <td className="px-3 py-2 align-top">
                  <span className="font-medium text-slate-900">{doc.fileName}</span>
                  {doc.version != null && doc.version > 1 && (
                    <span className="ml-1.5 text-xs text-slate-500">v{doc.version}</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-slate-700">{doc.documentType}</td>
                <td className="px-3 py-2 align-top">
                  <Badge variant={documentStatusVariant(doc.status)}>{documentStatusLabel(doc.status)}</Badge>
                  {doc.rejectionReason && doc.status === 'REJECTED' && (
                    <div className="mt-1 text-sm text-slate-600">{doc.rejectionReason}</div>
                  )}
                  {doc.adminRemarks && (
                    <div className="mt-1 text-sm text-slate-600">Remarks: {doc.adminRemarks}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-sm text-slate-600">
                  <div>Uploaded: {formatCompanyDate(doc.createdAt)}</div>
                  {(doc.verifiedAt || ['VERIFIED', 'REJECTED', 'PENDING_WITH_CLIENT'].includes(doc.status)) &&
                    (doc.verifiedAt || doc.updatedAt) && (
                      <div className="text-slate-500">
                        Reviewed: {formatCompanyDate(doc.verifiedAt ?? doc.updatedAt)}
                      </div>
                    )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onView(doc.id, doc.fileName)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(doc.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                    {!isAggregatorView && isReviewableDocStatus(doc.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => onApprove(doc.id)}
                          disabled={busyId !== null}
                          className="rounded border border-green-800 bg-green-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          {busyId === doc.id ? '…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(doc.id)}
                          disabled={busyId !== null}
                          className="rounded border border-red-800 bg-red-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          {busyId === doc.id ? '…' : 'Reject'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkPendingWithClient(doc.id)}
                          disabled={busyId !== null}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {busyId === doc.id ? '…' : 'Pending with client'}
                        </button>
                      </>
                    )}
                    {!isAggregatorView &&
                      isAggregatorCompany &&
                      doc.documentType === 'AGREEMENT_DRAFT' &&
                      doc.id === latestAgreementDraftId &&
                      (() => {
                        const alreadyNotified = company?.onboardingStage === 'AGREEMENT_DRAFT_SHARED';
                        const stageBlocked = !notifyStageAllowed;
                        const busy = notifyDraftBusyId !== null;
                        const disabled = busy || stageBlocked;
                        const label =
                          notifyDraftBusyId === doc.id
                            ? 'Notifying…'
                            : alreadyNotified
                              ? 'Re-notify draft shared'
                              : 'Notify draft shared';
                        const tooltip = stageBlocked
                          ? 'Draft can only be notified while the stage is "KYC review" or "Agreement draft shared".'
                          : alreadyNotified
                            ? 'Resend the agreement draft email to the client with the latest draft.'
                            : 'Email this draft to the client and advance the stage to "Agreement draft shared".';
                        return (
                          <button
                            type="button"
                            onClick={() => onNotifyAgreementDraftShared(doc.id)}
                            disabled={disabled}
                            title={tooltip}
                            className={
                              disabled
                                ? 'cursor-not-allowed rounded border border-slate-400 bg-slate-400 px-2 py-1 text-xs text-white'
                                : 'rounded border border-sky-800 bg-sky-800 px-2 py-1 text-xs text-white'
                            }
                          >
                            {label}
                          </button>
                        );
                      })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
