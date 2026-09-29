import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Mark } from "@/components/brand/Mark";
import { HourPicker } from "@/components/hour/HourPicker";
import { EmptyState } from "@/components/threshold/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGuides } from "@/hooks/useCatalogue";
import { useMySessions } from "@/hooks/useMine";
import { busyKey } from "@/hooks/useSlots";
import { api } from "@/lib/data";
import { MIN_NOTICE_HOURS, detectTimezone, fmt, fmtTime } from "@/lib/time";
import { BookingError } from "@/lib/types";
import { capitalize, pronounsOf } from "@/lib/utils";

/**
 * Moving a session, without writing to anyone. Same rules as booking; the
 * Guide's calendar, the buffers and the letter's seal all follow on their own.
 */
export default function Move() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  const sessions = useMySessions();
  const guides = useGuides();
  const [tz, setTz] = useState(detectTimezone);
  const [value, setValue] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const session = sessions.data?.find((s) => s.id === id);
  const guide = guides.data?.find((g) => g.id === session?.guide_id);
  const duration = session ? (new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60_000 : 0;
  const firstName = guide?.name.split(" ")[0] ?? "Your Guide";
  const tooLate = session ? new Date(session.starts_at).getTime() < Date.now() + MIN_NOTICE_HOURS * 3600_000 : false;
  const chosen = useMemo(() => (value ? new Date(value) : null), [value]);

  const move = async () => {
    if (!session || !value || !guide) return;
    setMoving(true);
    try {
      await api.reschedule(session.id, value);
      await Promise.all([qc.invalidateQueries({ queryKey: ["mine"] }), qc.invalidateQueries({ queryKey: busyKey(guide.id) })]);
      toast(`Moved to ${fmt(value, tz, "EEEE d MMMM")}, ${fmtTime(value, tz)}.`, {
        description: `${firstName}'s calendar already shows it. There's nothing you need to send.`,
      });
      navigate("/record");
    } catch (err) {
      const code = err instanceof BookingError ? err.code : "unknown";
      void qc.invalidateQueries({ queryKey: busyKey(guide.id) });
      setValue(null);
      setNotice(
        code === "slot_taken" || code === "day_full"
          ? `${fmt(value, tz, "EEEE d MMMM, HH:mm")} was given to someone else a moment ago. Your session hasn't moved. These are the hours that remain.`
          : code === "too_late"
            ? "Your session is now less than a day away, and can no longer be moved."
            : code === "too_soon"
              ? "That hour is now less than a day away, and Guides need a day to prepare. Your session hasn't moved."
              : code === "client_overlap"
                ? "You already have another session at that time. Your session hasn't moved."
                : "The session couldn't be moved. Nothing has changed — please try again.",
      );
    } finally {
      setMoving(false);
    }
  };

  const header = (
    <header className="sticky top-0 z-30 bg-charcoal-900/85 backdrop-blur-md">
      <div className="container flex h-20 items-center justify-between">
        <Link to="/" aria-label="Threshold, home" className="flex items-center gap-2.5">
          <Mark />
          <span className="hidden font-serif text-xl text-bone sm:inline">Threshold</span>
        </Link>
        <Link to="/record" className="text-sm text-bone-faint transition-colors duration-500 hover:text-bone-dim">
          Back to my thresholds
        </Link>
      </div>
    </header>
  );

  if (!ready || sessions.isLoading || guides.isLoading) {
    return (
      <div className="min-h-dvh">
        {header}
        <main className="container max-w-4xl pt-16">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-6 h-14 w-2/3" />
          <Skeleton className="mt-12 h-96 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!user || !session || !guide || session.status !== "held" || new Date(session.starts_at) <= new Date()) {
    return (
      <div className="min-h-dvh">
        {header}
        <main>
          <EmptyState
            title="This session can't be moved."
            action={
              <Button asChild variant="outline">
                <Link to="/record">Return to your record</Link>
              </Button>
            }
          >
            It may have been released or already crossed, or it belongs to someone else.
          </EmptyState>
        </main>
      </div>
    );
  }

  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);

  return (
    <div className="min-h-dvh">
      {header}
      <main className="container max-w-4xl px-6 pb-6 pt-10 md:px-10 md:pt-16">
        <header className="mb-12 animate-rise-in">
          <p className="eyebrow mb-6">Move this session</p>
          <h1 className="text-balance font-serif text-[2.5rem] leading-[1.04] text-bone md:text-[3.5rem]">Choose a new hour.</h1>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-bone-dim">
            You don't need to write to {firstName}. {capitalize(pronounsOf(guide.pronouns).possessive)} calendar, the stillness around your session
            and your letter's seal all move with it. Your answers come too.
          </p>
          <p className="mt-6 text-sm text-bone-faint">
            Currently{" "}
            <span className="text-bone">
              {fmt(start, tz, "EEEE d MMMM")}, {fmtTime(start, tz)}–{fmtTime(end, tz)}
            </span>
          </p>
        </header>

        {tooLate ? (
          <div className="rounded-lg border border-bone/10 px-6 py-12 text-center">
            <p className="font-serif text-3xl text-bone">This session is less than a day away.</p>
            <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-bone-dim">
              {firstName} is already preparing for you, so it can no longer be moved. You can still release it from your record.
            </p>
          </div>
        ) : (
          <HourPicker
            guide={guide}
            durationMin={duration}
            practicalMin={session.session_type === "aftermath" ? 60 : 0}
            tz={tz}
            onTzChange={setTz}
            value={value}
            onChange={setValue}
            notice={notice}
            onNotice={setNotice}
            ignoreStart={session.starts_at}
          />
        )}

        <div className="pointer-events-none sticky bottom-0 z-10 -mx-6 mt-16 bg-gradient-to-t from-charcoal-900 via-charcoal-900/95 to-transparent px-6 pb-6 pt-10 md:-mx-10 md:px-10 md:pb-10">
          <div className="pointer-events-auto flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="-ml-4 px-4">
              <Link to="/record">
                <ArrowLeft aria-hidden /> Keep the current time
              </Link>
            </Button>
            {!tooLate && (
              <Button onClick={move} disabled={!chosen || moving} className="min-w-[11rem]">
                {moving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Moving…
                  </>
                ) : chosen ? (
                  `Move to ${fmt(chosen, tz, "EEE d MMM")}, ${fmtTime(chosen, tz)}`
                ) : (
                  "Choose an hour"
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
