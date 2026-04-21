import type { AdminCompany, AdminDocumentListItem } from '../../services/admin';
import DocumentTableSection from './DocumentTableSection';

const DOC_FILTER = {
  kyc: (d: AdminDocumentListItem) =>
    ![
      'AGREEMENT_DRAFT',
      'AGREEMENT_SIGNED',
      'AGREEMENT_FINAL',
      'NOC_ASPIRE_COWORKS',
      'NOC_LANDLORD',
      'ELECTRICITY_BILL',
      'WIFI_BILL',
    ].includes(d.documentType),
};

type Props = {
  company: AdminCompany;
  documents: AdminDocumentListItem[];
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

export default function CompanyReviewDocumentsTab({
  company,
  documents,
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
  const common = {
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
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      role="tabpanel"
      id="company-review-panel-documents"
      aria-labelledby="company-review-tab-documents"
    >
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Documents</h2>
      <p className="mb-6 text-sm text-slate-600">
        {isAggregatorView
          ? 'Download or view any uploaded document. Upload signed agreements and agreement drafts from the Agreements & uploads tab.'
          : 'Download any file; use Approve / Reject / Pending with client for documents awaiting review.'}
      </p>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents yet.</p>
      ) : (
        <>
          <DocumentTableSection title="KYC Documents" sectionDocs={documents.filter(DOC_FILTER.kyc)} {...common} />
          <DocumentTableSection
            title="Agreement draft"
            sectionDocs={documents.filter((d) => d.documentType === 'AGREEMENT_DRAFT')}
            {...common}
          />
          <DocumentTableSection
            title="Signed agreement"
            sectionDocs={documents.filter((d) => d.documentType === 'AGREEMENT_SIGNED')}
            {...common}
          />
          <DocumentTableSection
            title="Final Agreement"
            sectionDocs={documents.filter((d) => d.documentType === 'AGREEMENT_FINAL')}
            {...common}
          />
          <DocumentTableSection
            title="NOC from Aspire Coworks"
            sectionDocs={documents.filter((d) => d.documentType === 'NOC_ASPIRE_COWORKS')}
            {...common}
          />
          <DocumentTableSection
            title="NOC from Landlord"
            sectionDocs={documents.filter((d) => d.documentType === 'NOC_LANDLORD')}
            {...common}
          />
          <DocumentTableSection
            title="Electricity Bill"
            sectionDocs={documents.filter((d) => d.documentType === 'ELECTRICITY_BILL')}
            {...common}
          />
          <DocumentTableSection
            title="Wifi Bill"
            sectionDocs={documents.filter((d) => d.documentType === 'WIFI_BILL')}
            {...common}
          />
        </>
      )}
    </section>
  );
}
