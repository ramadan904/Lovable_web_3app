import { Link } from "react-router-dom";
import { PageShell } from "@/components/brand/PageShell";
import { GuideMark } from "@/components/brand/GuideMark";
import { Reveal } from "@/components/threshold/Reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuides, useThresholds } from "@/hooks/useCatalogue";
import { useNow } from "@/hooks/useNow";
import { PRESENCE } from "@/lib/data/seed";
import { fmtTime } from "@/lib/time";
import { spell } from "@/lib/utils";

export default function Guides() {
  const guides = useGuides();
  const thresholds = useThresholds();
  const now = useNow(60_000);
  const nameOf = (slug: string) => thresholds.data?.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <PageShell>
      <div className="container max-w-5xl pb-28 pt-10 md:pt-16">
        <header className="mb-16 max-w-2xl md:mb-24">
          <p className="eyebrow mb-6">Threshold Guides</p>
          <h1 className="text-balance font-serif text-5xl leading-[1.02] text-bone md:text-7xl animate-rise-in">
            {guides.data ? `${spell(guides.data.length).replace(/^./, (c) => c.toUpperCase())} people` : "The people"} who hold these moments.
          </h1>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-bone-dim">
            Every Guide has sat beside people at the edge of something permanent — many have crossed one themselves. In the ritual you'll only meet the
            few who hold your threshold.
          </p>
        </header>

        <div className="space-y-4">
          {guides.isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          {guides.data?.map((g, i) => (
            <Reveal key={g.id} delay={(i % 3) * 60}>
              <article className="grid gap-8 rounded-lg border border-bone/[0.08] p-6 transition-colors duration-700 hover:border-bone/20 md:grid-cols-[5.5rem_1fr_auto] md:p-10">
                <GuideMark name={g.name} presence={g.presence} size="lg" />
                <div className="min-w-0">
                  <h2 className="font-serif text-[2rem] leading-tight text-bone">
                    {g.name}
                    {g.pronouns && <span className="ml-3 font-sans text-xs text-bone-faint">{g.pronouns}</span>}
                  </h2>
                  <p className="mt-1 text-sm text-bone-dim">
                    <span className="text-copper-bright">{PRESENCE[g.presence].name}</span> · {g.location}, {fmtTime(now, g.timezone)} now · {g.years_holding} years
                  </p>
                  <blockquote className="mt-5 font-serif text-xl italic leading-snug text-bone/90">“{g.statement}”</blockquote>
                  <p className="mt-4 text-[0.9375rem] leading-relaxed text-bone-dim">{g.background}</p>
                  <p className="mt-5 text-sm leading-relaxed text-bone-faint">
                    Holds: {g.thresholds.map(nameOf).join(" · ")}
                  </p>
                </div>
                <div className="md:self-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/begin?guide=${g.slug}`}>Begin with {g.name.split(" ")[0]}</Link>
                  </Button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
