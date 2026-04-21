/** Loading skeleton aligned with Company review tabbed layout. */
export default function CompanyReviewSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading company">
      <div className="h-8 w-48 rounded-md bg-slate-200" />
      <div className="h-4 w-full max-w-xl rounded bg-slate-100" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-28 rounded-t-md bg-slate-200" />
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 max-w-2xl rounded bg-slate-100" />
          <div className="h-32 w-full rounded-md bg-slate-50" />
        </div>
      </div>
    </div>
  );
}
