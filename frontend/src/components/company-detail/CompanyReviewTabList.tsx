import type { CompanyReviewTabId } from './companyReviewTypes';
import { COMPANY_REVIEW_TABS } from './companyReviewTypes';

type Props = {
  activeTab: CompanyReviewTabId;
  onChange: (tab: CompanyReviewTabId) => void;
};

/**
 * Accessible horizontal tab bar for Company review (admin + aggregator).
 */
export default function CompanyReviewTabList({ activeTab, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Company review sections"
      className="mt-6 flex flex-wrap gap-1 border-b border-slate-200 pb-px sm:gap-2"
    >
      {COMPANY_REVIEW_TABS.map(({ id, label }) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`company-review-tab-${id}`}
            aria-selected={selected}
            aria-controls={`company-review-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={[
              'rounded-t-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
              selected
                ? 'border border-b-0 border-slate-200 bg-white text-slate-900 shadow-sm'
                : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
