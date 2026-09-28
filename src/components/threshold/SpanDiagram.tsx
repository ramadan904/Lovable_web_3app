import { cn } from "@/lib/utils";

/**
 * The shape of a held session: stillness before, the session, stillness after.
 * Widths are proportional to minutes, so buffers read as real time.
 */
export function SpanDiagram({
  durationMin,
  bufferMin = 45,
  practicalMin = 0,
  labels = true,
  times,
  className,
  active = true,
}: {
  durationMin: number;
  bufferMin?: number;
  practicalMin?: number;
  labels?: boolean;
  times?: { prepare: string; start: string; end: string; rest: string };
  className?: string;
  active?: boolean;
}) {
  const total = durationMin + bufferMin * 2;
  const pct = (m: number) => `${(m / total) * 100}%`;
  const held = durationMin - practicalMin;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex h-9 w-full overflow-hidden rounded-[3px]"
        role="img"
        aria-label={`${bufferMin} minutes of preparation, a ${durationMin}-minute session${practicalMin ? ` including ${practicalMin} practical minutes` : ""}, then ${bufferMin} minutes of rest. No one else is booked in that time.`}
      >
        <div className="buffer-hatch border-r border-charcoal-900" style={{ width: pct(bufferMin) }} />
        <div
          className={cn("transition-colors duration-700 ease-quiet", active ? "bg-copper/80" : "bg-bone/15")}
          style={{ width: pct(held) }}
        />
        {practicalMin > 0 && (
          <div
            className={cn("border-l border-charcoal-900 transition-colors duration-700 ease-quiet", active ? "bg-copper/40" : "bg-bone/10")}
            style={{ width: pct(practicalMin) }}
          />
        )}
        <div className="buffer-hatch border-l border-charcoal-900" style={{ width: pct(bufferMin) }} />
      </div>
      {labels && (
        <div className="mt-2.5 flex text-[0.6875rem] leading-tight text-bone-faint">
          <div style={{ width: pct(bufferMin) }} className="pr-2">
            {times ? <span className="block text-bone-dim tabular-nums">{times.prepare}</span> : null}
            Guide prepares
          </div>
          <div style={{ width: pct(held) }} className="px-2">
            {times ? <span className="block text-bone tabular-nums">{times.start}</span> : null}
            {practicalMin ? `Held · ${held} min` : `Your session · ${durationMin} min`}
          </div>
          {practicalMin > 0 && (
            <div style={{ width: pct(practicalMin) }} className="px-2">
              Practical · {practicalMin}
            </div>
          )}
          <div style={{ width: pct(bufferMin) }} className="pl-2 text-right">
            {times ? <span className="block text-bone-dim tabular-nums">{times.end}</span> : null}
            Guide rests
          </div>
        </div>
      )}
    </div>
  );
}
