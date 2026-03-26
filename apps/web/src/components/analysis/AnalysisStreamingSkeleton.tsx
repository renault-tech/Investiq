"use client";

export function AnalysisStreamingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse p-6">
      {/* Skeleton block 1 */}
      <div>
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-md mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[90%] bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[85%] bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
      </div>
      {/* Skeleton block 2 */}
      <div>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[95%] bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[80%] bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[85%] bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
      </div>
      {/* Skeleton block 3 */}
      <div>
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded-md mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-[70%] bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
      </div>
    </div>
  );
}
