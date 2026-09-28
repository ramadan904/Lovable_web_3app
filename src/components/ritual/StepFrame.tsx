import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROMAN, cn } from "@/lib/utils";
import { STEPS } from "@/hooks/useRitual";

export function StepHeader({
  step,
  title,
  children,
  className,
}: {
  step: number;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-12 md:mb-16", className)}>
      <p className="eyebrow mb-6 flex items-center gap-3">
        <span className="font-serif text-sm normal-case tracking-normal text-copper-bright">{ROMAN[step]}</span>
        <span aria-hidden className="h-px w-6 bg-bone/20" />
        {STEPS[step]}
      </p>
      <h1
        tabIndex={-1}
        data-autofocus
        className="text-balance font-serif text-[2.5rem] leading-[1.04] text-bone outline-none md:text-[3.5rem]"
      >
        {title}
      </h1>
      {children && <div className="mt-6 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-bone-dim">{children}</div>}
    </header>
  );
}

export function StepActions({
  onBack,
  onNext,
  nextLabel = "Continue",
  canNext = true,
  busy = false,
  hint,
  children,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: ReactNode;
  canNext?: boolean;
  busy?: boolean;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-10 -mx-6 mt-16 bg-gradient-to-t from-charcoal-900 via-charcoal-900/95 to-transparent px-6 pb-6 pt-10 md:-mx-10 md:px-10 md:pb-10">
      <div className="pointer-events-auto flex items-center justify-between gap-4">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} className="-ml-4 px-4" disabled={busy}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-5">
          {hint && <span className="hidden text-xs text-bone-faint md:inline">{hint}</span>}
          {children}
          {onNext && (
            <Button onClick={onNext} disabled={!canNext || busy} aria-disabled={!canNext || busy} className="min-w-[9.5rem]">
              {nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RitualProgress({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Ritual progress" className="flex items-center gap-1.5">
      {STEPS.map((name, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <button
            key={name}
            type="button"
            disabled={!done}
            onClick={() => onJump(i)}
            aria-current={current ? "step" : undefined}
            aria-label={`${ROMAN[i]}. ${name}${done ? " (return to this step)" : current ? " (current)" : ""}`}
            className={cn(
              "group relative h-6 w-5 md:w-8",
              done ? "cursor-pointer" : "cursor-default",
            )}
          >
            <span
              className={cn(
                "absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-all duration-700 ease-quiet",
                current && "h-[2px] bg-copper-bright",
                done && "bg-bone/45 group-hover:bg-bone/80",
                !done && !current && "bg-bone/10",
              )}
            />
          </button>
        );
      })}
      <span className="ml-3 hidden font-serif text-sm text-bone-faint sm:inline" aria-hidden>
        {ROMAN[Math.min(step, STEPS.length - 1)]} <span className="text-bone-ghost">/</span> {ROMAN[STEPS.length - 1]}
      </span>
    </nav>
  );
}
