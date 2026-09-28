import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Mark } from "@/components/brand/Mark";
import { SealedEnvelope } from "@/components/threshold/SealedEnvelope";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGuides } from "@/hooks/useCatalogue";
import { useMyLetters, useMySessions } from "@/hooks/useMine";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/data";
import { detectTimezone, fmt, relativeFromNow } from "@/lib/time";

export default function Letter() {
  const { id } = useParams();
  const { user, ready } = useAuth();
  const letters = useMyLetters();
  const sessions = useMySessions();
  const guides = useGuides();
  const now = useNow();
  const tz = useMemo(detectTimezone, []);
  const qc = useQueryClient();

  const letter = letters.data?.find((l) => l.id === id);
  const session = sessions.data?.find((s) => s.id === letter?.session_id);
  const guide = guides.data?.find((g) => g.id === session?.guide_id);

  useEffect(() => {
    if (letter?.is_open && !letter.opened_at) {
      void api.openLetter(letter.id).then(() => qc.invalidateQueries({ queryKey: ["mine", "letters"] }));
    }
  }, [letter, qc]);

  const paragraphs = letter?.body?.split(/\n{2,}/) ?? [];

  return (
    <div className="min-h-dvh">
      <header className="container flex h-20 items-center justify-between">
        <Link to="/" aria-label="Threshold, home">
          <Mark />
        </Link>
        <Link to="/record" className="text-sm text-bone-faint transition-colors duration-500 hover:text-bone-dim">
          Back to my thresholds
        </Link>
      </header>

      <main className="container max-w-2xl pb-32 pt-10 md:pt-20">
        {!ready || letters.isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/6" />
          </div>
        ) : !user || !letter ? (
          <div className="py-20 text-center">
            <p className="font-serif text-3xl text-bone">This letter isn't here.</p>
            <p className="mt-3 text-bone-dim">Letters can only be opened by the person who wrote them.</p>
            <Link to="/record" className="mt-8 inline-block text-sm text-copper-bright underline underline-offset-4">
              Return to your record
            </Link>
          </div>
        ) : !letter.is_open ? (
          <div className="flex flex-col items-center py-16 text-center animate-fade-in">
            <SealedEnvelope className="h-32 w-40" />
            <h1 className="mt-12 font-serif text-4xl text-bone">Still sealed.</h1>
            <p className="mt-4 max-w-sm text-bone-dim">
              It opens {relativeFromNow(letter.unlocks_at, now)}, on {fmt(letter.unlocks_at, tz, "EEEE d MMMM 'at' HH:mm")}. Not before — not even for you.
            </p>
          </div>
        ) : (
          <article>
            <p className="eyebrow opacity-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
              Written {fmt(letter.created_at, tz, "d MMMM yyyy")}
              {guide && session && ` · before your session with ${guide.name.split(" ")[0]} on ${fmt(session.starts_at, tz, "d MMMM")}`}
            </p>
            <div className="copper-line mt-8 h-px w-24 origin-left animate-draw-line" aria-hidden />
            <div className="mt-14 space-y-7 font-serif text-[1.375rem] leading-[1.75] text-bone/90 md:text-[1.5rem]">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="whitespace-pre-line opacity-0 animate-fade-in"
                  style={{ animationDelay: `${900 + i * 700}ms`, animationDuration: "1600ms" }}
                >
                  {p}
                </p>
              ))}
            </div>
            <p className="mt-20 text-center text-sm text-bone-faint opacity-0 animate-fade-in" style={{ animationDelay: `${1200 + paragraphs.length * 700}ms` }}>
              Take your time. It will stay here.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
