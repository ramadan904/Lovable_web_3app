import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageShell } from "@/components/brand/PageShell";
import { LetterCard } from "@/components/record/LetterCard";
import { SessionCard } from "@/components/record/SessionCard";
import { EmptyState } from "@/components/threshold/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGuides, useSessionTypes, useThresholds } from "@/hooks/useCatalogue";
import { useDemoEntry } from "@/hooks/useDemoEntry";
import { useMyLetters, useMySessions } from "@/hooks/useMine";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/data";
import { detectTimezone, fmt } from "@/lib/time";
import type { Session } from "@/lib/types";

export default function Record() {
  const { user, ready } = useAuth();
  const sessions = useMySessions();
  const letters = useMyLetters();
  const guides = useGuides();
  const types = useSessionTypes();
  const thresholds = useThresholds();
  const now = useNow(30_000);
  const tz = useMemo(detectTimezone, []);
  const qc = useQueryClient();
  const { enter, busy } = useDemoEntry();
  const navigate = useNavigate();

  const release = useMutation({
    mutationFn: (id: string) => api.cancelSession(id),
    onMutate: async (id) => {
      const key = ["mine", "sessions", user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Session[]>(key);
      qc.setQueryData<Session[]>(key, (list) =>
        list?.map((s) => (s.id === id ? { ...s, status: "cancelled", cancelled_at: new Date().toISOString() } : s)),
      );
      return { prev, key };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      toast("That time couldn't be released.", { description: "It may already have begun. Nothing has changed." });
    },
    onSuccess: () => toast("The time has been released.", { description: "If you wrote a letter, it has been returned to you, unopened." }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["mine"] });
      void qc.invalidateQueries({ queryKey: ["busy"] });
    },
  });

  const lookup = (s: Session) => ({
    guide: guides.data?.find((g) => g.id === s.guide_id),
    form: types.data?.find((t) => t.key === s.session_type),
    threshold: thresholds.data?.find((t) => t.slug === s.threshold_slug),
  });

  if (ready && !user) {
    return (
      <PageShell>
        <EmptyState
          title="Your record appears once you hold a time."
          action={
            <div className="flex flex-col items-center gap-5">
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/begin">Begin</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login?next=/record">Sign in</Link>
                </Button>
              </div>
              <button
                type="button"
                onClick={() => enter("client")}
                disabled={!!busy}
                className="text-sm text-bone-faint underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
              >
                {busy ? "Opening…" : "Or see an example record, as Inês"}
              </button>
            </div>
          }
        >
          Sessions you hold, the answers you gave, and the letters you've sealed will wait for you here.
        </EmptyState>
      </PageShell>
    );
  }

  if (user?.role === "guide") {
    return (
      <PageShell>
        <EmptyState title="This is a Guide's account." action={<Button onClick={() => navigate("/guide")}>Go to your calendar</Button>}>
          Guides see their sessions and briefings in their calendar.
        </EmptyState>
      </PageShell>
    );
  }

  const loading = !ready || sessions.isLoading || letters.isLoading;
  const all = sessions.data ?? [];
  const upcoming = all.filter((s) => s.status === "held" && new Date(s.ends_at) > now);
  const crossed = all.filter((s) => s.status !== "cancelled" && new Date(s.ends_at) <= now).reverse();
  const released = all.filter((s) => s.status === "cancelled").reverse();
  const sessionById = new Map(all.map((s) => [s.id, s]));

  return (
    <PageShell>
      <div className="container max-w-5xl pb-24 pt-10 md:pt-16">
        <header className="mb-16 md:mb-24">
          <p className="eyebrow mb-6">My thresholds</p>
          <h1 className="font-serif text-5xl leading-none text-bone md:text-7xl animate-rise-in">
            {user?.display_name ? `${user.display_name}.` : "Your record."}
          </h1>
          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-bone-dim">
            What you have held, what you have crossed, and the letters waiting for you on the other side.
          </p>
        </header>

        <section aria-labelledby="held-h" className="mb-20">
          <SectionTitle id="held-h" title="Held" count={upcoming.length} />
          {loading ? (
            <Skeleton className="h-72 w-full rounded-lg" />
          ) : upcoming.length ? (
            <div className="space-y-4">
              {upcoming.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  {...lookup(s)}
                  tz={tz}
                  now={now}
                  onRelease={() => release.mutate(s.id)}
                  releasing={release.isPending && release.variables === s.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-bone/10 px-6 py-12 text-center">
              <p className="font-serif text-2xl text-bone">Nothing is held right now.</p>
              <p className="mt-2 text-sm text-bone-faint">When the next door comes, you know where to find us.</p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/begin">Begin</Link>
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="letters-h" className="mb-20">
          <SectionTitle id="letters-h" title="Letters" count={letters.data?.length ?? 0} />
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          ) : letters.data?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {letters.data.map((l) => {
                const s = sessionById.get(l.session_id);
                const g = s ? lookup(s).guide : undefined;
                return (
                  <LetterCard
                    key={l.id}
                    letter={l}
                    tz={tz}
                    now={now}
                    returned={s?.status === "cancelled"}
                    context={s ? `written before ${g ? `your session with ${g.name.split(" ")[0]}` : "your session"}` : "written before your session"}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[0.9375rem] text-bone-faint">No letters yet. The next time you hold a threshold, you can write to who you'll be after it.</p>
          )}
        </section>

        {crossed.length > 0 && (
          <section aria-labelledby="crossed-h" className="mb-20">
            <SectionTitle id="crossed-h" title="Crossed" count={crossed.length} />
            <ul className="border-t border-bone/[0.07]">
              {crossed.map((s) => {
                const { guide, threshold } = lookup(s);
                return (
                  <li key={s.id} className="grid gap-1 border-b border-bone/[0.07] py-5 md:grid-cols-[10rem_1fr_auto] md:items-baseline md:gap-8">
                    <span className="text-sm tabular-nums text-bone-faint">{fmt(s.starts_at, tz, "d MMMM yyyy")}</span>
                    <span className="font-serif text-xl text-bone/85">{threshold?.name ?? s.threshold_words ?? "Threshold"}</span>
                    <span className="text-sm text-bone-faint">with {guide?.name ?? "your Guide"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {released.length > 0 && (
          <section aria-labelledby="released-h">
            <SectionTitle id="released-h" title="Released" count={released.length} />
            <ul className="border-t border-bone/[0.07]">
              {released.map((s) => {
                const { guide, threshold } = lookup(s);
                return (
                  <li key={s.id} className="grid gap-1 border-b border-bone/[0.07] py-4 text-bone-faint md:grid-cols-[10rem_1fr_auto] md:items-baseline md:gap-8">
                    <span className="text-sm tabular-nums line-through decoration-bone/20">{fmt(s.starts_at, tz, "d MMMM yyyy")}</span>
                    <span className="font-serif text-lg">{threshold?.name ?? "Threshold"}</span>
                    <span className="text-sm">with {guide?.name ?? "your Guide"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function SectionTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <div className="mb-6 flex items-baseline gap-4">
      <h2 id={id} className="font-serif text-3xl text-bone">
        {title}
      </h2>
      <span className="text-sm tabular-nums text-bone-faint">{count}</span>
      <span className="h-px flex-1 bg-bone/[0.07]" aria-hidden />
    </div>
  );
}
