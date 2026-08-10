/** Loading fallback for next/dynamic chart imports — visually identical to
 * ChartCard's own isLoading state, so there's no flash/mismatch between
 * "chunk still downloading" and "data still fetching". Recharts pulls in a
 * meaningful chunk of JS; every chart is code-split (see the various
 * `dynamic(() => import(...))` call sites) so pages that don't render a
 * chart yet don't pay for it on first load. */
export function ChartSkeleton() {
  return <div className="absolute inset-0 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />;
}
