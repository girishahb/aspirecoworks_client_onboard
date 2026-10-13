import type { AdminCompany, ComplianceStatus } from '../../services/admin';
import type { AggregatorBooking } from '../../services/aggregatorProfile';
import OnboardingStepper from '../OnboardingStepper';
import BookingDetailsCard from './BookingDetailsCard';
import CompanyProfileEditSection from './CompanyProfileEditSection';
import { formatCompanyDate } from './formatting';

type Props = {
  company: AdminCompany;
  compliance: ComplianceStatus | null;
  bookings: AggregatorBooking[] | null;
  isAggregator: boolean;
  isAggregatorView: boolean;
  canEditProfile: boolean;
  inviteSentBanner: boolean;
  inviteSentFromCreate: boolean;
  inviteStatusFromCreate?: 'sent' | 'already_activated' | 'failed' | null;
  inviteErrorFromCreate?: string | null;
  inviteMessageFromCreate?: string | null;
  resendInviteBusy: boolean;
  onResendInvite: () => void;
  onDismissInviteBanner: () => void;
  onCompanyUpdated: (company: AdminCompany) => void;
};

export default function CompanyReviewOverviewTab({
  company,
  compliance,
  bookings,
  isAggregator,
  isAggregatorView,
  canEditProfile,
  inviteSentBanner,
  inviteSentFromCreate,
  inviteStatusFromCreate,
  inviteErrorFromCreate,
  inviteMessageFromCreate,
  resendInviteBusy,
  onResendInvite,
  onDismissInviteBanner,
  onCompanyUpdated,
}: Props) {
  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="company-review-panel-overview"
      aria-labelledby="company-review-tab-overview"
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Onboarding progress</h2>
        <OnboardingStepper
          stage={company.onboardingStage}
          showPercentage
          clientChannel={company.clientChannel ?? null}
          view={isAggregatorView ? 'aggregator' : 'admin'}
        />
        {company.activationDate && (
          <p className="mt-3 text-sm text-slate-600">
            Activated on {formatCompanyDate(company.activationDate)}
          </p>
        )}
      </section>

      {inviteStatusFromCreate === 'already_activated' && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="m-0 font-medium">
            {inviteMessageFromCreate ||
              'This email already has a client login. No invite was sent.'}
          </p>
          <p className="mt-1 mb-0 text-sky-900/80">
            They can sign in with their existing password. For a fresh set-password email, use a
            different contact email that has not been activated yet.
          </p>
        </div>
      )}

      {inviteStatusFromCreate === 'failed' && inviteErrorFromCreate && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="font-medium text-amber-950">
            Client was created, but the invite email failed: {inviteErrorFromCreate}. Check Resend /
            EMAIL_FROM, then use Resend Invite.
          </span>
          <button
            type="button"
            onClick={onResendInvite}
            disabled={resendInviteBusy}
            className="rounded bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {resendInviteBusy ? 'Sending…' : 'Resend Invite'}
          </button>
        </div>
      )}

      {(inviteSentBanner || inviteSentFromCreate) && inviteStatusFromCreate !== 'failed' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-3">
          <span className="font-medium text-green-900">
            Invite email sent to client. They can set their password and log in.
          </span>
          <button
            type="button"
            onClick={onDismissInviteBanner}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {canEditProfile ? (
        <CompanyProfileEditSection company={company} onSaved={onCompanyUpdated} />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Company profile</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-800">
            <p>
              <strong className="text-slate-700">Company name:</strong> {company.companyName}
            </p>
            <p>
              <strong className="text-slate-700">Contact email:</strong> {company.contactEmail}
            </p>
            {company.contactPhone && (
              <p>
                <strong className="text-slate-700">Contact phone:</strong> {company.contactPhone}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mt-0 text-lg font-semibold text-slate-900">Portal & renewal</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-800">
          {company.clientUser?.isActivated === false && (
            <p className="text-amber-800">
              Client has not set their password yet. They cannot log in until they complete the invite
              link or use forgot password.
            </p>
          )}
          {(company.clientUser?.isActivated === false || company.clientUser == null) && (
            <p>
              <button
                type="button"
                onClick={onResendInvite}
                disabled={resendInviteBusy}
                className="rounded bg-sky-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {resendInviteBusy ? 'Sending…' : 'Resend Invite'}
              </button>
            </p>
          )}
          <p>
            <strong className="text-slate-700">Renewal date:</strong> {formatCompanyDate(company.renewalDate)}
          </p>
          <p>
            <strong className="text-slate-700">Renewal status:</strong> {company.renewalStatus ?? '—'}
          </p>
          {compliance && (
            <p>
              <strong className="text-slate-700">Compliance:</strong>{' '}
              {compliance.isCompliant ? 'Compliant' : 'Missing documents'}
              {compliance.missingDocumentTypes?.length
                ? ` (${compliance.missingDocumentTypes.join(', ')})`
                : ''}
            </p>
          )}
        </div>
      </section>

      {isAggregator && bookings && bookings.length > 0 && <BookingDetailsCard bookings={bookings} />}
    </div>
  );
}
