import { Van } from "./Van";

/** Shown while a page's code loads: a van and a few skeleton lines, not a blank screen. */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16">
      <Van className="max-w-[16rem] animate-pulse" />
      <p className="font-display text-lg font-bold">Bertha's warming up…</p>
      <div className="w-full max-w-sm space-y-2" aria-hidden="true">
        <div className="h-3 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
