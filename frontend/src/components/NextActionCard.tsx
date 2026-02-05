import { Link } from 'react-router-dom';
import { CreditCard, Upload, FileCheck, FileText, Download, CheckCircle, Clock } from 'lucide-react';

export interface NextActionCardProps {
  stage: string | null | undefined;
  /** Optional: payment link if payment is pending */
  paymentLink?: string | null;
  /** Optional: agreement draft document ID if available */
  agreementDraftId?: string | null;
  /** Optional: final agreement document ID if available */
  finalAgreementId?: string | null;
  /** Callback when action button is clicked */
  onActionClick?: () => void;
}

export default function NextActionCard({
  stage,
  paymentLink,
  agreementDraftId,
  finalAgreementId,
  onActionClick,
}: NextActionCardProps) {
  if (!stage) {
    return (
      <div className="rounded-lg border-2 border-primary bg-primary/5 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Clock className="h-6 w-6 text-primary" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-semibold text-text">Getting Started</h3>
            <p className="mb-3 text-sm text-muted">Your onboarding is being set up.</p>
          </div>
        </div>
      </div>
    );
  }

  const actionConfig = getActionConfig(stage, paymentLink, agreementDraftId, finalAgreementId);

  return (
    <div
      className={`rounded-lg border-2 p-6 shadow-sm ${
        actionConfig.type === 'success'
          ? 'border-success bg-success/5'
          : actionConfig.type === 'warning'
            ? 'border-accent bg-accent/5'
            : 'border-primary bg-primary/5'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`rounded-lg p-3 ${
            actionConfig.type === 'success'
              ? 'bg-success/10'
              : actionConfig.type === 'warning'
                ? 'bg-accent/10'
                : 'bg-primary/10'
          }`}
        >
          {actionConfig.icon}
        </div>
        <div className="flex-1">
          <h3 className="mb-1 text-lg font-semibold text-text">{actionConfig.title}</h3>
          <p className="mb-4 text-sm text-muted">{actionConfig.description}</p>
          {actionConfig.button && (
            <div className="flex flex-wrap gap-2">
              {actionConfig.button.href ? (
                <Link
                  to={actionConfig.button.href}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  {actionConfig.button.icon}
                  {actionConfig.button.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onActionClick || actionConfig.button.onClick}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  {actionConfig.button.icon}
                  {actionConfig.button.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getActionConfig(
  stage: string,
  paymentLink?: string | null,
  agreementDraftId?: string | null,
  finalAgreementId?: string | null,
) {
  switch (stage) {
    case 'PAYMENT_PENDING':
      return {
        type: 'warning' as const,
        title: 'Complete Your Payment',
        description: 'Complete your payment to begin onboarding. Once payment is confirmed, you can proceed with KYC document uploads.',
        icon: <CreditCard className="h-6 w-6 text-accent" strokeWidth={2} />,
        button: paymentLink
          ? {
              label: 'Pay Now',
              icon: <CreditCard className="h-4 w-4" />,
              onClick: () => window.open(paymentLink, '_blank', 'noopener,noreferrer'),
            }
          : {
              label: 'Payment Link Coming Soon',
              icon: <Clock className="h-4 w-4" />,
            },
      };

    case 'PAYMENT_CONFIRMED':
    case 'KYC_IN_PROGRESS':
      return {
        type: 'warning' as const,
        title: 'Upload Your KYC Documents',
        description: 'Upload your contracts, licenses, identification, and other required documents to proceed with onboarding.',
        icon: <Upload className="h-6 w-6 text-accent" strokeWidth={2} />,
        button: {
          label: 'Upload Documents',
          icon: <Upload className="h-4 w-4" />,
          href: '/client/documents',
        },
      };

    case 'KYC_REVIEW':
      return {
        type: 'info' as const,
        title: 'Documents Under Review',
        description: 'Your KYC documents are being reviewed by our team. We will notify you once the review is complete.',
        icon: <FileCheck className="h-6 w-6 text-primary" strokeWidth={2} />,
      };

    case 'AGREEMENT_DRAFT_SHARED':
      return {
        type: 'warning' as const,
        title: 'Review and Sign Your Agreement',
        description: 'Please review the agreement draft we shared. Download it, sign it, and upload the signed copy.',
        icon: <FileText className="h-6 w-6 text-accent" strokeWidth={2} />,
        button: agreementDraftId
          ? {
              label: 'Download Draft',
              icon: <Download className="h-4 w-4" />,
              href: `/client/documents`,
            }
          : {
              label: 'View Documents',
              icon: <FileText className="h-4 w-4" />,
              href: '/client/documents',
            },
      };

    case 'SIGNED_AGREEMENT_RECEIVED':
      return {
        type: 'info' as const,
        title: 'Waiting for Final Agreement',
        description: 'We have received your signed agreement. We are preparing the final stamped agreement and will share it shortly.',
        icon: <Clock className="h-6 w-6 text-primary" strokeWidth={2} />,
      };

    case 'FINAL_AGREEMENT_SHARED':
      return {
        type: 'success' as const,
        title: 'Final Agreement Ready',
        description: 'Your final stamped agreement is ready for download. Your account activation is in progress.',
        icon: <FileText className="h-6 w-6 text-success" strokeWidth={2} />,
        button: finalAgreementId
          ? {
              label: 'Download Final Agreement',
              icon: <Download className="h-4 w-4" />,
              href: '/client/documents',
            }
          : {
              label: 'View Documents',
              icon: <FileText className="h-4 w-4" />,
              href: '/client/documents',
            },
      };

    case 'ACTIVE':
    case 'COMPLETED':
      return {
        type: 'success' as const,
        title: 'Your Workspace Access is Active',
        description: 'Congratulations! Your onboarding is complete and your workspace access is active. You can now use all features.',
        icon: <CheckCircle className="h-6 w-6 text-success" strokeWidth={2} />,
        button: {
          label: 'View Documents',
          icon: <FileText className="h-4 w-4" />,
          href: '/client/documents',
        },
      };

    default:
      return {
        type: 'info' as const,
        title: 'Onboarding in Progress',
        description: 'Your onboarding is being processed. We will notify you of the next steps.',
        icon: <Clock className="h-6 w-6 text-primary" strokeWidth={2} />,
      };
  }
}
