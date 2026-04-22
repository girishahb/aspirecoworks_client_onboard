import type { AdminCompany, AdminDocumentListItem, AdminPostAgreementDocumentType } from '../../services/admin';
import type { AggregatorBooking } from '../../services/aggregatorProfile';
import { POST_AGREEMENT_DOC_TYPES } from './agreementDocTypes';

type Props = {
  company: AdminCompany;
  documents: AdminDocumentListItem[];
  isAggregatorView: boolean;
  bookings: AggregatorBooking[] | null;
  agreementDraftFiles: File[];
  setAgreementDraftFiles: (files: File[]) => void;
  agreementDraftUploading: boolean;
  agreementDraftError: string | null;
  templateDraftGenerating: boolean;
  templateDraftSuccess: string | null;
  notifyDraftSuccess: string | null;
  notifyDraftError: string | null;
  aggregatorSignedFile: File | null;
  setAggregatorSignedFile: (f: File | null) => void;
  aggregatorSignedUploading: boolean;
  aggregatorSignedSuccess: string | null;
  aggregatorSignedError: string | null;
  finalAgreementFile: File | null;
  setFinalAgreementFile: (f: File | null) => void;
  selectedFinalDocType: AdminPostAgreementDocumentType;
  setSelectedFinalDocType: (t: AdminPostAgreementDocumentType) => void;
  finalAgreementUploading: boolean;
  finalAgreementError: string | null;
  onUploadAgreementDraft: () => void;
  onGenerateTemplate: () => void;
  onUploadAggregatorSigned: () => void;
  onUploadFinalAgreement: () => void;
};

export default function CompanyReviewAgreementTab({
  company,
  documents,
  isAggregatorView,
  bookings,
  agreementDraftFiles,
  setAgreementDraftFiles,
  agreementDraftUploading,
  agreementDraftError,
  templateDraftGenerating,
  templateDraftSuccess,
  notifyDraftSuccess,
  notifyDraftError,
  aggregatorSignedFile,
  setAggregatorSignedFile,
  aggregatorSignedUploading,
  aggregatorSignedSuccess,
  aggregatorSignedError,
  finalAgreementFile,
  setFinalAgreementFile,
  selectedFinalDocType,
  setSelectedFinalDocType,
  finalAgreementUploading,
  finalAgreementError,
  onUploadAgreementDraft,
  onGenerateTemplate,
  onUploadAggregatorSigned,
  onUploadFinalAgreement,
}: Props) {
  const isAggregatorChannel = company?.clientChannel === 'AGGREGATOR';

  return (
    <section
      className="space-y-6"
      role="tabpanel"
      id="company-review-panel-agreements"
      aria-labelledby="company-review-tab-agreements"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Agreements & uploads</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload drafts, generate from template (GR, BR, or Mailing Address), signed agreements, and post-agreement documents.
        </p>
      </div>

      {isAggregatorView && isAggregatorChannel && <AggregatorSignedAgreementCard {...{ company, documents, aggregatorSignedFile, setAggregatorSignedFile, aggregatorSignedUploading, aggregatorSignedSuccess, aggregatorSignedError, onUploadAggregatorSigned }} />}

      {!isAggregatorView && (
        <>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mt-0 text-base font-semibold text-slate-900">Upload agreement draft(s)</h3>
            <p className="text-sm text-slate-600">
              Upload one or more draft agreements. The client will be notified by email. Supports .pdf, .doc, .docx.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                onChange={(e) => setAgreementDraftFiles(Array.from(e.target.files ?? []))}
                disabled={agreementDraftUploading}
              />
              <button
                type="button"
                onClick={onUploadAgreementDraft}
                disabled={agreementDraftFiles.length === 0 || agreementDraftUploading}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {agreementDraftUploading
                  ? 'Uploading…'
                  : agreementDraftFiles.length > 0
                    ? `Upload ${agreementDraftFiles.length} file(s)`
                    : 'Upload and notify client'}
              </button>
              {isAggregatorChannel && (
                <TemplateGenerateButton
                  company={company}
                  bookings={bookings}
                  templateDraftGenerating={templateDraftGenerating}
                  agreementDraftUploading={agreementDraftUploading}
                  onGenerateTemplate={onGenerateTemplate}
                />
              )}
            </div>
            {isAggregatorChannel && (
              <p className="mt-2 text-xs text-teal-800">
                Aggregator client: auto-generate agreement draft (GR, BR, or Mailing Address template) from registration data. Use
                &ldquo;Notify draft shared&rdquo; on the Documents tab after KYC is approved.
              </p>
            )}
            {agreementDraftFiles.length > 0 && (
              <p className="mt-2 text-sm text-slate-600">Selected: {agreementDraftFiles.map((f) => f.name).join(', ')}</p>
            )}
            {templateDraftSuccess && <p className="mt-2 text-sm text-green-800">{templateDraftSuccess}</p>}
            {notifyDraftSuccess && <p className="mt-2 text-sm text-green-800">{notifyDraftSuccess}</p>}
            {notifyDraftError && <p className="mt-2 text-sm text-red-700">{notifyDraftError}</p>}
            {agreementDraftError && <p className="mt-2 text-sm text-red-700">{agreementDraftError}</p>}
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <h3 className="mt-0 text-base font-semibold text-slate-900">Upload post-agreement documents</h3>
            <p className="text-sm text-slate-600">
              After the signed agreement is received, upload one or more files. Only &quot;Final Agreement&quot; emails the
              client and advances stage the first time. Additional uploads are allowed after final agreement shared or
              activation.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={selectedFinalDocType}
                onChange={(e) => setSelectedFinalDocType(e.target.value as AdminPostAgreementDocumentType)}
                className="min-w-[180px] rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {POST_AGREEMENT_DOC_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFinalAgreementFile(e.target.files?.[0] ?? null)}
                disabled={finalAgreementUploading}
              />
              <button
                type="button"
                onClick={onUploadFinalAgreement}
                disabled={!finalAgreementFile || finalAgreementUploading}
                className="rounded border border-sky-800 bg-sky-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {finalAgreementUploading
                  ? 'Uploading…'
                  : selectedFinalDocType === 'AGREEMENT_FINAL'
                    ? 'Upload and notify client'
                    : 'Upload'}
              </button>
            </div>
            {finalAgreementError && <p className="mt-2 text-sm text-red-700">{finalAgreementError}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function TemplateGenerateButton({
  company,
  bookings,
  templateDraftGenerating,
  agreementDraftUploading,
  onGenerateTemplate,
}: {
  company: AdminCompany;
  bookings: AggregatorBooking[] | null;
  templateDraftGenerating: boolean;
  agreementDraftUploading: boolean;
  onGenerateTemplate: () => void;
}) {
  const SUPPORTED_TEMPLATE_PLANS = ['GR', 'BR', 'Mailing Address'] as const;
  const BLOCKED_TEMPLATE_STAGES = [
    'SIGNED_AGREEMENT_RECEIVED',
    'FINAL_AGREEMENT_SHARED',
    'ACTIVE',
    'COMPLETED',
    'REJECTED',
  ] as const;
  const latestBooking = bookings && bookings.length > 0 ? bookings[0] : null;
  const planType = latestBooking?.planType ?? null;
  const stage = company?.onboardingStage;
  const planSupported =
    planType !== null && (SUPPORTED_TEMPLATE_PLANS as readonly string[]).includes(planType);
  const stageBlocked = !!stage && (BLOCKED_TEMPLATE_STAGES as readonly string[]).includes(stage);
  const hasBooking = !!latestBooking;
  let tooltip = `Render the ${planType ?? ''} Leave & License template with this client's data in one click.`;
  if (!hasBooking) tooltip = 'No aggregator booking found for this client.';
  else if (!planSupported)
    tooltip = `Template available for plan types: ${SUPPORTED_TEMPLATE_PLANS.join(', ')} (current: ${planType ?? 'not set'}).`;
  else if (stageBlocked) tooltip = 'Agreement draft can no longer be generated: client has signed or completed.';

  const disabled =
    templateDraftGenerating || agreementDraftUploading || !hasBooking || !planSupported || stageBlocked;
  const buttonLabel = templateDraftGenerating
    ? 'Generating…'
    : planSupported
      ? `Generate draft from template (${planType})`
      : 'Generate draft from template';

  return (
    <button
      type="button"
      onClick={onGenerateTemplate}
      disabled={disabled}
      title={tooltip}
      className={
        disabled
          ? 'cursor-not-allowed rounded border border-slate-300 bg-slate-200 px-3 py-1.5 text-sm text-slate-500'
          : 'rounded border border-teal-700 bg-teal-700 px-3 py-1.5 text-sm text-white'
      }
    >
      {buttonLabel}
    </button>
  );
}

function AggregatorSignedAgreementCard({
  company,
  documents,
  aggregatorSignedFile,
  setAggregatorSignedFile,
  aggregatorSignedUploading,
  aggregatorSignedSuccess,
  aggregatorSignedError,
  onUploadAggregatorSigned,
}: Pick<
  Props,
  | 'company'
  | 'documents'
  | 'aggregatorSignedFile'
  | 'setAggregatorSignedFile'
  | 'aggregatorSignedUploading'
  | 'aggregatorSignedSuccess'
  | 'aggregatorSignedError'
  | 'onUploadAggregatorSigned'
>) {
  const stage = company?.onboardingStage;
  const canUpload = stage === 'AGREEMENT_DRAFT_SHARED' || stage === 'SIGNED_AGREEMENT_RECEIVED';
  const alreadyReceived = stage === 'SIGNED_AGREEMENT_RECEIVED';
  const latestSigned = documents
    .filter((d) => d.documentType === 'AGREEMENT_SIGNED')
    .reduce<{ fileName: string; version: number | null } | null>((acc, d) => {
      const v = d.version ?? 0;
      if (!acc || v > (acc.version ?? 0)) {
        return { fileName: d.fileName, version: d.version ?? null };
      }
      return acc;
    }, null);

  if (!canUpload) {
    if (stage && ['FINAL_AGREEMENT_SHARED', 'ACTIVE', 'COMPLETED'].includes(stage)) {
      return (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="mt-0 text-base font-semibold text-indigo-950">Signed agreement already received</h3>
          {latestSigned && (
            <p className="mt-1 text-sm text-indigo-900">
              Latest on file: {latestSigned.fileName}
              {latestSigned.version != null ? ` (v${latestSigned.version})` : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-lg border border-teal-600 bg-emerald-50 p-4">
      <h3 className="mt-0 text-base font-semibold text-emerald-950">Upload signed agreement</h3>
      <p className="text-sm text-emerald-900">
        {alreadyReceived
          ? 'A signed copy is on record. Uploading a new file creates a new version.'
          : 'Upload the scanned signed agreement. This moves onboarding to Signed Agreement Received for admin review.'}{' '}
        .pdf, .doc, .docx (max 10MB).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => setAggregatorSignedFile(e.target.files?.[0] ?? null)}
          disabled={aggregatorSignedUploading}
        />
        <button
          type="button"
          onClick={onUploadAggregatorSigned}
          disabled={!aggregatorSignedFile || aggregatorSignedUploading}
          className={
            !aggregatorSignedFile || aggregatorSignedUploading
              ? 'cursor-not-allowed rounded border border-slate-300 bg-slate-200 px-3 py-1.5 text-sm text-slate-500'
              : 'rounded border border-teal-700 bg-teal-700 px-3 py-1.5 text-sm text-white'
          }
        >
          {aggregatorSignedUploading ? 'Uploading…' : alreadyReceived ? 'Upload new version' : 'Upload signed agreement'}
        </button>
      </div>
      {aggregatorSignedFile && (
        <p className="mt-2 text-sm text-emerald-800">Selected: {aggregatorSignedFile.name}</p>
      )}
      {latestSigned && (
        <p className="mt-1 text-xs text-emerald-800">
          Latest on file: {latestSigned.fileName}
          {latestSigned.version != null ? ` (v${latestSigned.version})` : ''}
        </p>
      )}
      {aggregatorSignedSuccess && <p className="mt-2 text-sm text-green-800">{aggregatorSignedSuccess}</p>}
      {aggregatorSignedError && <p className="mt-2 text-sm text-red-700">{aggregatorSignedError}</p>}
    </div>
  );
}
