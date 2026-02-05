import { CreditCard, FileCheck, FileText, CheckCircle } from 'lucide-react';
import Badge from './Badge';

export interface SummaryCardsProps {
  stage: string | null | undefined;
  /** Payment status */
  paymentStatus?: 'pending' | 'completed' | 'none';
  /** KYC status */
  kycStatus?: 'pending' | 'under_review' | 'approved' | 'none';
  /** Agreement status */
  agreementStatus?: 'pending' | 'draft_shared' | 'signed' | 'final' | 'none';
  /** Activation status */
  activationStatus?: 'pending' | 'active' | 'none';
}

export default function SummaryCards({
  stage,
  paymentStatus = 'none',
  kycStatus = 'none',
  agreementStatus = 'none',
  activationStatus = 'none',
}: SummaryCardsProps) {
  // Auto-determine statuses from stage if not provided
  const autoPaymentStatus = getPaymentStatus(stage);
  const autoKycStatus = getKycStatus(stage);
  const autoAgreementStatus = getAgreementStatus(stage);
  const autoActivationStatus = getActivationStatus(stage);

  const cards = [
    {
      title: 'Payment Status',
      icon: <CreditCard className="h-5 w-5" strokeWidth={2} />,
      status: paymentStatus !== 'none' ? paymentStatus : autoPaymentStatus,
      description: getPaymentDescription(paymentStatus !== 'none' ? paymentStatus : autoPaymentStatus),
    },
    {
      title: 'KYC Status',
      icon: <FileCheck className="h-5 w-5" strokeWidth={2} />,
      status: kycStatus !== 'none' ? kycStatus : autoKycStatus,
      description: getKycDescription(kycStatus !== 'none' ? kycStatus : autoKycStatus),
    },
    {
      title: 'Agreement Status',
      icon: <FileText className="h-5 w-5" strokeWidth={2} />,
      status: agreementStatus !== 'none' ? agreementStatus : autoAgreementStatus,
      description: getAgreementDescription(agreementStatus !== 'none' ? agreementStatus : autoAgreementStatus),
    },
    {
      title: 'Activation Status',
      icon: <CheckCircle className="h-5 w-5" strokeWidth={2} />,
      status: activationStatus !== 'none' ? activationStatus : autoActivationStatus,
      description: getActivationDescription(activationStatus !== 'none' ? activationStatus : autoActivationStatus),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <div className="text-muted">{card.icon}</div>
                <h4 className="text-sm font-semibold text-text">{card.title}</h4>
              </div>
              <Badge variant={getBadgeVariant(card.status)} className="mb-2">
                {getStatusLabel(card.status)}
              </Badge>
              <p className="text-xs text-muted">{card.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getPaymentStatus(stage: string | null | undefined): string {
  if (!stage) return 'pending';
  if (stage === 'PAYMENT_PENDING') return 'pending';
  if (['PAYMENT_CONFIRMED', 'KYC_IN_PROGRESS', 'KYC_REVIEW', 'AGREEMENT_DRAFT_SHARED', 'SIGNED_AGREEMENT_RECEIVED', 'FINAL_AGREEMENT_SHARED', 'ACTIVE', 'COMPLETED'].includes(stage)) {
    return 'completed';
  }
  return 'pending';
}

function getKycStatus(stage: string | null | undefined): string {
  if (!stage) return 'none';
  if (stage === 'PAYMENT_CONFIRMED' || stage === 'KYC_IN_PROGRESS') return 'pending';
  if (stage === 'KYC_REVIEW') return 'under_review';
  if (['AGREEMENT_DRAFT_SHARED', 'SIGNED_AGREEMENT_RECEIVED', 'FINAL_AGREEMENT_SHARED', 'ACTIVE', 'COMPLETED'].includes(stage)) {
    return 'approved';
  }
  return 'none';
}

function getAgreementStatus(stage: string | null | undefined): string {
  if (!stage) return 'none';
  if (stage === 'AGREEMENT_DRAFT_SHARED') return 'draft_shared';
  if (stage === 'SIGNED_AGREEMENT_RECEIVED') return 'signed';
  if (stage === 'FINAL_AGREEMENT_SHARED') return 'final';
  if (['ACTIVE', 'COMPLETED'].includes(stage)) return 'final';
  return 'none';
}

function getActivationStatus(stage: string | null | undefined): string {
  if (!stage) return 'pending';
  if (stage === 'ACTIVE' || stage === 'COMPLETED') return 'active';
  return 'pending';
}

function getBadgeVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'completed' || status === 'approved' || status === 'final' || status === 'active') {
    return 'approved';
  }
  if (status === 'under_review' || status === 'draft_shared' || status === 'signed') {
    return 'pending';
  }
  return 'pending';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Action Required',
    completed: 'Completed',
    under_review: 'Under Review',
    approved: 'Approved',
    draft_shared: 'Draft Shared',
    signed: 'Signed',
    final: 'Final',
    active: 'Active',
    none: 'Pending',
  };
  return labels[status] || 'Pending';
}

function getPaymentDescription(status: string): string {
  const descriptions: Record<string, string> = {
    pending: 'Payment pending',
    completed: 'Payment completed',
    none: 'Not started',
  };
  return descriptions[status] || 'Pending';
}

function getKycDescription(status: string): string {
  const descriptions: Record<string, string> = {
    pending: 'Upload documents',
    under_review: 'Under review',
    approved: 'Documents approved',
    none: 'Not started',
  };
  return descriptions[status] || 'Pending';
}

function getAgreementDescription(status: string): string {
  const descriptions: Record<string, string> = {
    draft_shared: 'Draft shared',
    signed: 'Signed received',
    final: 'Final agreement ready',
    none: 'Not started',
  };
  return descriptions[status] || 'Pending';
}

function getActivationDescription(status: string): string {
  const descriptions: Record<string, string> = {
    pending: 'In progress',
    active: 'Account active',
    none: 'Not started',
  };
  return descriptions[status] || 'Pending';
}
