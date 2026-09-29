import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { StepActions, StepHeader } from "./StepFrame";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import type { RitualDraft } from "@/hooks/useRitual";
import { api } from "@/lib/data";
import { LETTER_SEAL_HOURS, cityOf, durationWords, fmt, fmtTime } from "@/lib/time";
import type { Guide, SessionType, Threshold } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StepHold({
  draft,
  update,
  guide,
  form,
  threshold,
  onBack,
  onHold,
  holding,
  error,
  onJump,
}: {
  draft: RitualDraft;
  update: (p: Partial<RitualDraft>) => void;
  guide: Guide;
  form: SessionType;
  threshold: Threshold | undefined;
  onBack: () => void;
  onHold: () => Promise<void>;
  holding: boolean;
  error: string | null;
  onJump: (step: number) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const firstName = guide.name.split(" ")[0];
  const tz = draft.clientTz;
  const start = draft.slotStart ? new Date(draft.slotStart) : null;
  const end = start ? new Date(start.getTime() + form.duration_min * 60_000) : null;
  const unlocks = end ? new Date(end.getTime() + LETTER_SEAL_HOURS * 3600_000) : null;

  useEffect(() => {
    if (user?.display_name && !draft.clientName) update({ clientName: user.display_name });
  }, [user, draft.clientName, update]);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = mode === "signin" ? password.length > 0 : password.length >= 8;
  const ready = draft.clientName.trim().length > 0 && (!!user || (emailOk && passwordOk));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!ready || holding || authBusy) return;
    setAuthError(null);
    if (!user) {
      setAuthBusy(true);
      try {
        if (mode === "create") {
          const res = await api.signUp(email, password, draft.clientName);
          if (res.needsConfirmation) {
            setSentTo(email.trim());
            return;
          }
        } else {
          await api.signIn(email, password);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        return;
      } finally {
        setAuthBusy(false);
      }
    }
    await onHold();
  }

  const rows: { label: string; value: React.ReactNode; step: number }[] = [
    {
      label: "Threshold",
      value: (
        <>
          {threshold?.name ?? "In your own words"}
          {draft.thresholdWords.trim() && <span className="mt-1 block font-sans text-sm italic text-bone-faint">“{draft.thresholdWords.trim()}”</span>}
        </>
      ),
      step: 0,
    },
    { label: "Guide", value: `${guide.name}, ${guide.location}`, step: 1 },
    {
      label: "Your answers",
      value: `${draft.answers.filter((a) => a.trim()).length} of 3 written${draft.skipped.some(Boolean) ? ", the rest kept for the room" : ""}`,
      step: 2,
    },
    { label: "Form", value: `${form.name} · ${durationWords(form.duration_min)}`, step: 3 },
    {
      label: "The hour",
      value: start && end && (
        <>
          {fmt(start, tz, "EEEE d MMMM")}, {fmtTime(start, tz)}–{fmtTime(end, tz)}
          <span className="mt-1 block font-sans text-sm text-bone-faint">
            {cityOf(tz)} time
            {cityOf(tz) !== cityOf(guide.timezone) && ` · ${fmtTime(start, guide.timezone)} for ${firstName} in ${guide.location}`}
          </span>
        </>
      ),
      step: 4,
    },
    {
      label: "Letter",
      value:
        draft.letter.trim() && unlocks ? (
          <>
            Sealed until {fmt(unlocks, tz, "EEEE d MMMM, HH:mm")}
          </>
        ) : (
          <span className="text-bone-dim">No letter</span>
        ),
      step: 5,
    },
  ];

  if (sentTo) {
    return (
      <div className="py-10">
        <StepHeader step={6} title="Check your email.">
          We've sent a link to <span className="text-bone">{sentTo}</span>. Open it on this device and you'll return here
          with everything exactly as you left it. Your hour is not held until you return and hold it.
        </StepHeader>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <StepHeader step={6} title="Everything is ready.">
        Read it through once. When you hold this time, {firstName}'s calendar closes around it and your letter is sealed.
      </StepHeader>

      <dl className="border-t border-bone/[0.07]">
        {rows.map((r) => (
          <div key={r.label} className="group grid gap-1 border-b border-bone/[0.07] py-5 md:grid-cols-[12rem_1fr_auto] md:items-baseline md:gap-8">
            <dt className="eyebrow">{r.label}</dt>
            <dd className="font-serif text-xl leading-snug text-bone md:text-[1.375rem]">{r.value}</dd>
            <dd className="md:text-right">
              <button
                type="button"
                onClick={() => onJump(r.step)}
                className="text-xs text-bone-faint underline decoration-transparent underline-offset-4 transition-colors duration-500 hover:text-bone-dim hover:decoration-bone/30 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                Change<span className="sr-only"> {r.label.toLowerCase()}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-14 grid max-w-3xl gap-10">
        <div>
          <Label htmlFor="client-name">What should {firstName} call you?</Label>
          <Input
            id="client-name"
            value={draft.clientName}
            onChange={(e) => update({ clientName: e.target.value.slice(0, 60) })}
            placeholder="A first name, or initials"
            autoComplete="given-name"
            className="mt-2 font-serif text-2xl"
          />
        </div>

        {!user && (
          <fieldset className="rounded-lg border border-bone/[0.08] p-6 md:p-8">
            <legend className="px-2 font-serif text-2xl text-bone">{mode === "create" ? "Keep a record" : "Open your record"}</legend>
            <p className="-mt-1 mb-6 text-sm leading-relaxed text-bone-faint">
              {mode === "create"
                ? "Your record is where this session, your answers and your sealed letter will wait for you."
                : "Sign in, and this session will be added to your record."}
            </p>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  aria-describedby="password-hint"
                />
                {mode === "create" && (
                  <p id="password-hint" className={cn("mt-2 text-xs transition-colors duration-500", password && password.length < 8 ? "text-copper-bright" : "text-bone-faint")}>
                    At least eight characters.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "create" ? "signin" : "create");
                setAuthError(null);
              }}
              className="mt-6 text-sm text-bone-faint underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
            >
              {mode === "create" ? "I already have a record" : "I'm new here"}
            </button>
          </fieldset>
        )}

        {(authError || error) && (
          <p role="alert" className="border-l border-destructive pl-4 text-[0.9375rem] leading-relaxed text-[hsl(8_60%_72%)] animate-fade-in">
            {authError ?? error}
          </p>
        )}
      </div>

      <StepActions
        onBack={onBack}
        busy={holding || authBusy}
        hint={user ? `Holding as ${user.email}` : undefined}
      >
        <button
          type="submit"
          disabled={!ready || holding || authBusy}
          className="inline-flex h-14 min-w-[12rem] items-center justify-center gap-2 rounded-full bg-bone px-9 text-base font-medium text-charcoal-950 transition-[background-color,box-shadow,opacity] duration-700 ease-quiet hover:shadow-[0_0_60px_-10px_hsl(var(--copper)/0.6)] disabled:opacity-35"
        >
          {holding || authBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {authBusy ? "Opening your record…" : "Holding…"}
            </>
          ) : (
            "Hold this time"
          )}
        </button>
      </StepActions>
    </form>
  );
}
