import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock, CloudRain, CreditCard, Loader2, LockKeyhole, MapPin, Sparkles, Umbrella } from "lucide-react";
import { toast } from "sonner";
import { SlotPicker } from "@/components/SlotPicker";
import { WeatherStatus } from "@/components/WeatherStatus";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/useNow";
import {
  ADDONS, CURE_RAIN_LIMIT, DEPOSIT_CENTS, PARKING, PLAN_DISCOUNT, PLAN_WEEKS, SERVICES, VEHICLES, ZONES, ZONE_ZIP, dollars, hoursLabel, isCovered, needsDryDay, quote, zoneForZip,
  type AddonKey, type Parking, type ServiceKey, type VehicleKind,
} from "@/lib/business";
import { parseInquiry, understood } from "@/lib/inquiry";
import { BookingError } from "@/lib/model";
import { neighbourDeal, validate } from "@/lib/engine";
import { actions, getState, nowMs, useStore } from "@/lib/store";
import { fmtDayLong, fmtTime, localDate } from "@/lib/time";
import { forecastFor } from "@/lib/weather";
import { cn } from "@/lib/utils";

const STEPS = ["Your car", "Where", "When", "Review & pay"] as const;

interface Form {
  vehicle: VehicleKind | null;
  label: string;
  service: ServiceKey | null;
  addons: AddonKey[];
  zip: string;
  address: string;
  parking: Parking | null;
  gateCode: string;
  notes: string;
  startMs: number | null;
  /** Care plan: repeat every this many weeks, or none. */
  plan: number | null;
  name: string;
  phone: string;
  email: string;
}

interface Ask { message: string; when: string | null; wantDate: string | null }

function initialForm(p: URLSearchParams): { form: Form; step: number; ask: Ask | null } {
  const v = p.get("v");
  const s = p.get("s");
  const vehicle = v && v in VEHICLES ? (v as VehicleKind) : null;
  const service = s && s in SERVICES ? (s as ServiceKey) : null;
  const addons = (p.get("a") ?? "").split(",").filter((a): a is AddonKey => a in ADDONS);
  const z = p.get("z");
  const zip = p.get("zip") ?? (z && z in ZONE_ZIP ? ZONE_ZIP[z as keyof typeof ZONE_ZIP] : "");
  const pk = p.get("p");
  const parking = pk && pk in PARKING ? (pk as Parking) : null;
  const t = Number(p.get("t")) || null;
  const form: Form = { vehicle, label: "", service, addons, zip, address: "", parking, gateCode: "", notes: "", startMs: t, plan: null, name: "", phone: "", email: "" };
  const step = !vehicle || !service ? 0 : 1;
  const ask: Ask | null = p.get("src") === "ask" && p.get("m") ? { message: p.get("m")!, when: p.get("w"), wantDate: p.get("d") } : null;
  return { form, step, ask };
}

function RadioCard({ name, value, checked, onChange, children, className }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("relative block cursor-pointer", className)}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="flex h-full flex-col gap-1 rounded-lg border bg-card p-4 transition-colors peer-checked:border-primary peer-checked:bg-fern-soft peer-checked:shadow-card peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sun hover:border-foreground/50">
        {children}
      </span>
      <span className="pointer-events-none absolute -top-2.5 right-3 hidden items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground shadow-card peer-checked:inline-flex" aria-hidden="true">
        <Check className="size-3" /> Selected
      </span>
    </label>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}


const digitsOf = (v: string) => v.replace(/\D/g, "");
/** Forgiving checks with a specific, friendly reason for each thing that's missing. */
export function contactProblems(f: { name: string; phone: string; email: string }) {
  return {
    name: f.name.trim().length < 2 ? "Add your name so Dario knows who to look for." : null,
    phone: digitsOf(f.phone).length < 10 ? "Add a mobile number with area code so we can text you (like 503 555 0100)." : null,
    email: !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? "Add an email like name@example.com for your receipt." : null,
  };
}

/** Any way of typing a zip (97212, 97212-1234, "OR 97212", "97 212") becomes five digits. */
const zipOf = (raw: string) => raw.replace(/\D/g, "").slice(0, 5);

/** What, if anything, stops this step from moving on. Pure, so the message always matches the form as it is right now. */
function stepProblem(step: number, f: { vehicle: unknown; service: unknown; zip: string; address: string; parking: unknown; startMs: number | null }): string | null {
  if (step === 0 && (!f.vehicle || !f.service)) return "Pick what you drive and the service you'd like.";
  if (step === 1) {
    const zip = zipOf(f.zip);
    if (zip.length < 5) return "Enter your 5-digit zip so we can check the drive.";
    if (!zoneForZip(zip)) return "That zip is outside our service area.";
    if (!f.address.trim()) return "Add the street address where the car will be.";
    if (!f.parking) return "Tell us where the car will be parked.";
  }
  if (step === 2 && !f.startMs) return "Pick a time to continue.";
  return null;
}

/** One of the three contact fields: numbered, marked required, with a live tick and its own specific error. */
function ContactField({ n, id, label, hint, error, valid, children }: { n: number; id: string; label: string; hint: string; error: string | null; valid: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2 text-base">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">{n}</span>
        {label}
        <span className="text-xs font-semibold text-danger">Required</span>
        {valid && <Check className="ml-auto size-4 text-fern" aria-label="looks good" />}
      </Label>
      {children}
      {error
        ? <p id={`${id}-err`} className="text-sm font-medium text-danger">{error}</p>
        : <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Book() {
  const [params] = useSearchParams();
  const init = useMemo(() => initialForm(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<Form>(init.form);
  const [step, setStep] = useState(init.step);
  const [error, setError] = useState<string | null>(null); // booking errors (slot taken, etc.)
  const [attempted, setAttempted] = useState<number | null>(null); // the step whose Continue was pressed while something was missing
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const askParsed = useMemo(() => (init.ask ? parseInquiry(init.ask.message, nowMs()) : null), [init.ask]);
  const now = useNow();
  const nav = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  // The message for a step that couldn't advance is worked out from the form as it is NOW, so the moment the
  // problem is fixed the message is gone: it can never be left over from an earlier attempt.
  const shownError = (attempted === step ? stepProblem(step, form) : null) ?? error;
  // Changing the plan (car, service, place) can invalidate a chosen time, so it clears.
  // Changing these changes how long the job takes or where Dario drives, so a time chosen earlier no longer applies.
  // Parking is not one of them: it only changes the rain rules, which are re-checked when the calendar opens.
  const PLAN_KEYS: (keyof Form)[] = ["vehicle", "service", "addons", "zip"];
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v, ...(PLAN_KEYS.includes(k) ? { startMs: null } : {}) }));
    setError(null);
  };

  // On the last step, put the cursor in the first contact field that's still empty, so typing can start at once.
  const [touched, setTouched] = useState({ name: false, phone: false, email: false });
  const [contactTried, setContactTried] = useState(false); // pressed "book" with a field still missing
  useEffect(() => {
    if (step === 3) {
      const first = (["name", "phone", "email"] as const).find((k) => !form[k].trim());
      if (first) { document.getElementById(first)?.focus(); return; }
    }
    heading.current?.focus();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // An error under a long form can be off screen: bring it into view so a stuck tap always explains itself.
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!shownError) return;
    const el = errorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "instant" });
  }, [shownError]);

  const zip5 = zipOf(form.zip);
  const zone = zip5.length === 5 ? zoneForZip(zip5) : null;
  const zipBad = zip5.length === 5 && !zone;
  const q = form.vehicle && form.service ? quote(form.vehicle, form.service, form.addons, zone) : null;
  const covered = form.parking ? isCovered(form.parking) : false;

  // A time carried in from a link (or picked earlier) must still be open.
  useEffect(() => {
    if (step !== 2 || !form.startMs || !q || !zone) return;
    const gone = validate(getState(), { startMs: form.startMs, durationMin: q.durationMin, zone }, nowMs()) !== null;
    const tooWet = !!form.parking && needsDryDay(form.addons, form.parking) && forecastFor(localDate(form.startMs), getState().stormDays).rain >= CURE_RAIN_LIMIT;
    if (gone || tooWet) setForm((f) => ({ ...f, startMs: null }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps


  // What has been chosen so far and what comes next: shown beside the Continue button so progress is never a guess.
  const guide: { ready: boolean; text: string; next: string } | null = (() => {
    if (step === 0) {
      if (form.vehicle && form.service && q) return { ready: true, text: `${VEHICLES[form.vehicle].name} · ${SERVICES[form.service].name} · ${dollars(q.totalCents)}`, next: "address" };
      return { ready: false, text: !form.vehicle ? "Choose your car, then a service" : "Now choose a service", next: "address" };
    }
    if (step === 1) {
      const ready = !!zone && !!form.address.trim() && !!form.parking;
      return { ready, text: ready ? `${form.address}, ${ZONES[zone!].name}` : !zone ? "Add your zip code" : !form.address.trim() ? "Add your street address" : "Say where the car will be parked", next: "times" };
    }
    if (step === 2) {
      return { ready: !!form.startMs, text: form.startMs ? `${fmtDayLong(form.startMs)} at ${fmtTime(form.startMs)}` : "Pick a day, then a time", next: "review" };
    }
    const p = contactProblems(form);
    const ok = !p.name && !p.phone && !p.email;
    return { ready: ok, text: ok ? `Ready to book, ${form.name.trim().split(/\s+/)[0]}` : "Add your name, mobile number and email above", next: "" };
  })();

  // Autofill or a script can put a value in a field without React hearing about it. Pull what is on screen into the form
  // the moment the person touches anything (before any re-render could overwrite it), and again on submit.
  const syncFromDom = () => {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
    const patch: Partial<Form> = {};
    for (const k of ["name", "phone", "email"] as const) {
      const v = val(k);
      if (v !== undefined && v !== form[k]) patch[k] = v;
    }
    if (step === 1) {
      const z = val("zip");
      if (z !== undefined && zipOf(z) !== form.zip) { patch.zip = zipOf(z); patch.startMs = null; }
      const a = val("address");
      if (a !== undefined && a !== form.address) patch.address = a;
    }
    if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }));
  };

  const next = () => {
    let f = form;
    if (step === 1) {
      // Trust what is on screen: autofill, a paste or a script can fill a field without React hearing about it.
      const zipEl = document.getElementById("zip") as HTMLInputElement | null;
      const addrEl = document.getElementById("address") as HTMLInputElement | null;
      const zipNow = zipOf(zipEl?.value ?? f.zip);
      const addrNow = addrEl?.value ?? f.address;
      if (zipNow !== f.zip || addrNow !== f.address) {
        f = { ...f, zip: zipNow, address: addrNow, ...(zipNow !== f.zip ? { startMs: null } : {}) };
        setForm(f);
      }
    }
    setError(null);
    if (stepProblem(step, f)) { setAttempted(step); return; }
    setAttempted(null);
    setStep(step + 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trust what is on screen: autofill or a script can fill a field without React hearing about it.
    const onScreen = (id: string, fallback: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? fallback;
    const f = { ...form, name: onScreen("name", form.name), phone: onScreen("phone", form.phone), email: onScreen("email", form.email) };
    if (f.name !== form.name || f.phone !== form.phone || f.email !== form.email) setForm(f);
    const problems = contactProblems(f);
    if (problems.name || problems.phone || problems.email) {
      setTouched({ name: true, phone: true, email: true });
      setContactTried(true);
      document.getElementById(problems.name ? "name" : problems.phone ? "phone" : "email")?.focus();
      return;
    }
    if (!form.vehicle || !form.service || !form.parking || !form.startMs) return;
    setBusy(true);
    window.setTimeout(() => {
      try {
        const job = actions.book({
          customer: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() },
          vehicle: { kind: form.vehicle!, label: form.label.trim() || VEHICLES[form.vehicle!].name.toLowerCase() },
          service: form.service!, addons: form.addons, zip: zip5, address: form.address, parking: form.parking!,
          access: { gateCode: form.gateCode, notes: form.notes }, startMs: form.startMs!, plan: form.plan,
        });
        nav(`/b/${job.code}?new=1`);
      } catch (err) {
        setBusy(false);
        if (err instanceof BookingError && (err.code === "slot_taken" || err.code === "too_soon")) {
          set("startMs", null);
          setStep(2);
          toast.error("That time was just taken", { description: "Someone booked it while you were typing. Here's what's open now." });
        } else if (err instanceof BookingError) {
          setError(err.message);
        } else throw err;
      }
    }, 450);
  };

  const joinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setError("Add your name, mobile number and email to join the waitlist.");
    if (!form.vehicle || !form.service || !form.parking) return;
    actions.joinWaitlist({
      customer: { name: form.name, phone: form.phone, email: form.email },
      vehicle: { kind: form.vehicle, label: form.label.trim() || VEHICLES[form.vehicle].name.toLowerCase() },
      service: form.service, addons: form.addons, zip: zip5, address: form.address, parking: form.parking,
    });
    setWaitlisted(true);
    setError(null);
  };

  const toggleAddon = (a: AddonKey) => set("addons", form.addons.includes(a) ? form.addons.filter((x) => x !== a) : [...form.addons, a]);

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow">Book a detail</p>
        <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Real times. Rain handled. No texting back and forth.</h1>
      </div>

      {init.ask && step < 3 && <FromMessage ask={init.ask} />}

      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className={cn("flex w-full flex-col gap-1.5 text-left disabled:cursor-default", i > step && "opacity-60")}
            >
              <span className={cn("h-1.5 rounded-full transition-colors", i < step ? "bg-primary" : i === step ? "bg-sun" : "bg-border")} />
              <span className="text-xs font-semibold sm:text-sm"><span className="text-muted-foreground">{i + 1}. </span>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); next(); }} onPointerDownCapture={syncFromDom} onFocusCapture={syncFromDom} onBlurCapture={syncFromDom} className="space-y-8" noValidate>
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
            {["What are we cleaning?", "Where do we find you?", "When suits you?", "Review and pay the deposit"][step]}
          </h2>

          {step === 0 && (
            <div className="space-y-8">
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">What do you drive?</legend>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {Object.values(VEHICLES).map((v) => (
                    <RadioCard key={v.key} name="vehicle" value={v.key} checked={form.vehicle === v.key} onChange={() => set("vehicle", v.key)}>
                      <span className="font-display text-lg font-bold">{v.name}</span>
                      <span className="text-sm text-muted-foreground">{v.examples}</span>
                    </RadioCard>
                  ))}
                </div>
              </fieldset>
              <Field id="label" label="What does it look like? (optional)" hint="So Dario finds the right car in a row of them.">
                <Input id="label" value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Grey Subaru Outback" maxLength={40} aria-describedby="label-hint" />
              </Field>
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">What does it need?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.values(SERVICES).map((s) => {
                    const sq = form.vehicle ? quote(form.vehicle, s.key, [], null) : null;
                    return (
                      <RadioCard key={s.key} name="service" value={s.key} checked={form.service === s.key} onChange={() => set("service", s.key)}>
                        <span className="flex items-baseline justify-between gap-3 pr-7">
                          <span className="font-display text-lg font-bold">{s.name}</span>
                          <span className="font-bold">{sq ? dollars(sq.serviceCents) : `from ${dollars(s.baseCents)}`}</span>
                        </span>
                        <span className="text-sm text-foreground/80">{s.line}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" />{sq ? `About ${hoursLabel(sq.durationMin)}` : `From ${hoursLabel(s.baseMin)}`}</span>
                      </RadioCard>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Anything extra?</legend>
                <p className="mb-3 text-sm text-muted-foreground">Add-ons change the time, so the calendar on the next steps stays honest.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.values(ADDONS).map((a) => (
                    <label key={a.key} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 has-[:checked]:border-primary has-[:checked]:bg-fern-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sun">
                      <input type="checkbox" checked={form.addons.includes(a.key)} onChange={() => toggleAddon(a.key)} className="mt-1 size-4 accent-[hsl(var(--primary))]" />
                      <span className="flex-1">
                        <span className="flex justify-between gap-2 font-semibold"><span>{a.name}</span><span>+{dollars(a.cents)}</span></span>
                        <span className="block text-sm text-muted-foreground">{a.line} · +{a.min} min</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
                <Field id="zip" label="Zip code" error={zipBad ? "We don't reach that zip yet. We cover Portland and the westside suburbs." : null}
                  hint={zone ? undefined : "We'll check the drive from Dario's last job."}>
                  <Input id="zip" inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={(e) => set("zip", zipOf(e.target.value))} onBlur={(e) => { const z = zipOf(e.target.value); if (z !== form.zip) set("zip", z); }} placeholder="97212" aria-describedby={zipBad ? "zip-err" : "zip-hint"} aria-invalid={zipBad} />
                </Field>
                <Field id="address" label="Street address">
                  <Input id="address" autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="3415 NE 15th Ave" />
                </Field>
              </div>
              {askParsed?.zipInferred && form.zip === askParsed.zip && (
                <p className="rounded-md bg-sun-soft px-3 py-2 text-sm text-sun-ink" role="note">
                  We used <strong>{form.zip}</strong> for {askParsed.place ?? "your area"}. If your street is in a different zip, change it: the drive time depends on it.
                </p>
              )}
              {zone && (
                <p className="flex items-start gap-2 rounded-md bg-fern-soft p-3 text-sm text-fern-ink" role="status">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span><strong>{ZONES[zone].name}</strong> ({ZONES[zone].areas}). {ZONES[zone].feeCents ? `A ${dollars(ZONES[zone].feeCents)} travel fee applies.` : "No travel fee."}</span>
                </p>
              )}
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Where will the car be parked?</legend>
                <p className="mb-3 text-sm text-muted-foreground">This is how we handle Portland's weather for you.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(PARKING) as Parking[]).map((k) => (
                    <RadioCard key={k} name="parking" value={k} checked={form.parking === k} onChange={() => set("parking", k)}>
                      <span className="flex items-center gap-2 pr-7 font-display text-lg font-bold">
                        {PARKING[k].covered ? <Umbrella className="size-4 text-fern" aria-hidden="true" /> : <CloudRain className="size-4 text-rain" aria-hidden="true" />}
                        {PARKING[k].name}
                      </span>
                      <span className="text-sm text-muted-foreground">{PARKING[k].line}</span>
                    </RadioCard>
                  ))}
                </div>
                {form.parking && <WeatherStatus parking={form.parking} className="mt-4" />}
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="gate" label="Gate or door code (optional)" hint="Only Dario sees this, and only on the day.">
                  <Input id="gate" value={form.gateCode} onChange={(e) => set("gateCode", e.target.value)} placeholder="#4471" aria-describedby="gate-hint" autoComplete="off" />
                </Field>
                <Field id="notes" label="Anything Dario should know? (optional)" hint="Dogs, parking, where the key is.">
                  <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-12" rows={2} aria-describedby="notes-hint" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && q && zone && form.parking && (
            <div className="space-y-6">
              <SlotPicker
                durationMin={q.durationMin} zone={zone} parking={form.parking} now={now} value={form.startMs} showDeals needsDry={needsDryDay(form.addons, form.parking)} preferDate={init.ask?.wantDate ?? null}
                onChange={(ms) => set("startMs", ms)}
                whenEmpty={<WaitlistForm form={form} set={set} onSubmit={joinWaitlist} done={waitlisted} error={error} />}
              />
              {!waitlisted && (
                <div className="rounded-lg border bg-card p-4">
                  <button type="button" className="font-semibold text-fern underline underline-offset-4" onClick={() => setJoining((j) => !j)} aria-expanded={joining}>
                    Nothing suits? Join the waitlist
                  </button>
                  {joining && <div className="mt-4"><WaitlistForm form={form} set={set} onSubmit={joinWaitlist} done={waitlisted} error={error} /></div>}
                </div>
              )}
              {waitlisted && <p role="status" className="rounded-md bg-fern-soft p-4 font-semibold text-fern-ink">You're on the waitlist. If a slot frees up that fits, you'll get a text with a two-hour window to claim it.</p>}
            </div>
          )}

          {step === 3 && q && form.startMs && zone && form.parking && (
            <div className="space-y-6">
              <section aria-labelledby="contact-h" className="space-y-4 rounded-lg border-2 border-primary/50 bg-card p-5 shadow-card">
                <div>
                  <h3 id="contact-h" className="font-display text-xl font-bold">Last thing: who should we text?</h3>
                  <p className="text-sm text-muted-foreground">Three quick fields. We only use them for your booking.</p>
                </div>
                {contactTried && (() => { const p = contactProblems(form); return (p.name || p.phone || p.email) ? (
                  <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
                    Add your name, a mobile number and a valid email to book. The fields to fix are marked below.
                  </p>
                ) : null; })()}
                <div className="grid gap-5 sm:grid-cols-2">
                  {(() => {
                    const p = contactProblems(form);
                    const err = (k: "name" | "phone" | "email") => (touched[k] ? p[k] : null);
                    const bad = (k: "name" | "phone" | "email") => !!err(k);
                    const ring = (k: "name" | "phone" | "email") => cn(bad(k) && "border-danger ring-2 ring-danger/40");
                    return (
                      <>
                        <ContactField n={1} id="name" label="Your name" hint="So Dario knows who to look for." error={err("name")} valid={!p.name}>
                          <Input id="name" autoComplete="name" enterKeyHint="next" required aria-required="true" aria-invalid={bad("name")} aria-describedby={bad("name") ? "name-err" : "name-hint"} className={ring("name")}
                            value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} placeholder="Alex Rivera" />
                        </ContactField>
                        <ContactField n={2} id="phone" label="Mobile number" hint="For your reminders and the on-the-way text." error={err("phone")} valid={!p.phone}>
                          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" required aria-required="true" aria-invalid={bad("phone")} aria-describedby={bad("phone") ? "phone-err" : "phone-hint"} className={ring("phone")}
                            value={form.phone} onChange={(e) => set("phone", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, phone: true }))} placeholder="(503) 555-0100" />
                        </ContactField>
                        <div className="sm:col-span-2">
                          <ContactField n={3} id="email" label="Email" hint="For your receipt and booking link." error={err("email")} valid={!p.email}>
                            <Input id="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" required aria-required="true" aria-invalid={bad("email")} aria-describedby={bad("email") ? "email-err" : "email-hint"} className={ring("email")}
                              value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} placeholder="alex@example.com" />
                          </ContactField>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button type="button" className="text-sm font-semibold text-fern underline underline-offset-4"
                  onClick={() => { setForm((f) => ({ ...f, name: "Alex Rivera", phone: "(503) 555-0142", email: "alex@example.com" })); setTouched({ name: false, phone: false, email: false }); setError(null); toast("Sample details filled in", { description: "Nothing is sent to anyone." }); }}>
                  Just trying it out? Fill in sample details
                </button>
              </section>

              <ReviewCard form={form} q={q} zone={zone} onChangeTime={() => setStep(2)} />
              <WeatherStatus
                parking={form.parking} startMs={form.startMs} durationMin={q.durationMin} zone={zone}
                onPick={(ms) => { set("startMs", ms); toast.success("Switched to a dry time"); }}
              />
              <fieldset className="rounded-lg border bg-card p-5">
                <legend className="px-1 font-display text-lg font-bold">Keep it clean? <span className="text-sm font-medium text-muted-foreground">(optional)</span></legend>
                <p className="mb-3 text-sm text-muted-foreground">
                  Choose a care plan and we book your next visit for you after each one: the same weekday and time if it's free, otherwise the nearest slot. <strong className="text-foreground">{Math.round(PLAN_DISCOUNT * 100)}% off every visit after this one, no deposit after the first.</strong> Skip or stop any time.
                </p>
                <div className="grid gap-2 sm:grid-cols-4">
                  {[null, ...PLAN_WEEKS].map((w) => (
                    <RadioCard key={String(w)} name="plan" value={String(w)} checked={form.plan === w} onChange={() => set("plan", w)}>
                      <span className="font-display text-base font-bold">{w === null ? "Just this once" : `Every ${w} weeks`}</span>
                      <span className="text-xs text-muted-foreground">{w === null ? "No plan" : w === 6 ? "Most popular" : `${Math.round(PLAN_DISCOUNT * 100)}% off after`}</span>
                    </RadioCard>
                  ))}
                </div>
              </fieldset>

              <div className="card space-y-3 p-5">
                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold"><LockKeyhole className="size-4 text-fern" aria-hidden="true" /> Pay the {dollars(DEPOSIT_CENTS)} deposit <span className="chip border-sun/50 bg-sun-soft text-xs text-sun-ink">Required to hold the slot</span></h3>
                <p className="rounded-md bg-fern-soft px-3 py-2 font-semibold text-fern-ink">
                  {dollars(DEPOSIT_CENTS)} deposit holds the slot. Fully refundable if we have to move you for rain.
                </p>
                <div className="flex items-center gap-3 rounded-md border bg-background p-3 text-sm">
                  <CreditCard className="size-5 shrink-0 text-fern" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Visa •••• 4242</p>
                    <p className="text-muted-foreground">One tap, no forms.</p>
                  </div>
                  <span className="chip border-fern/30 bg-fern-soft text-fern-ink">Secure</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  It comes off your total. It exists because one no-show costs a solo detailer a whole job, so here's how it works, in plain words:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  <li>Move or cancel free up to 24 hours before. The deposit is refunded or carried over.</li>
                  <li>We text you the day before. Tap <strong>Confirm</strong> and you're set.</li>
                  <li>No answer by three hours before? We release the slot to the waitlist and keep the deposit.</li>
                  <li>Rain on an outdoor job? We move you free, to a dry day you choose. If you'd rather not move, cancel for a full refund at any time.</li>
                </ul>
                <p className="text-sm font-semibold">No deposit, no slot: a time is only held once this is paid.</p>
                <p className="text-xs text-muted-foreground">No card is charged in this demo.</p>
              </div>
            </div>
          )}

          {shownError && step !== 2 && <p ref={errorRef} role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{shownError}</p>}
          {shownError && step === 2 && !joining && <p ref={errorRef} role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{shownError}</p>}

          <div className="sticky bottom-0 z-20 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
            {guide && (
              <p role="status" className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", guide.ready ? "text-fern-ink" : "text-muted-foreground")}>
                {guide.ready
                  ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Check className="size-3" /></span>
                  : <span className="size-2.5 shrink-0 rounded-full bg-sun" aria-hidden="true" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">{guide.text}</span>
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setError(null); setAttempted(null); setStep(step - 1); }}><ArrowLeft /> Back</Button> : <Button asChild variant="ghost"><Link to="/"><ArrowLeft /> Home</Link></Button>}
              {step < 3 ? (
                <Button type="submit" size="lg" variant={guide?.ready ? "default" : "outline"} className={cn("min-w-0 flex-1 sm:flex-none", guide?.ready && "shadow-lift ring-2 ring-sun ring-offset-2 ring-offset-background")}>
                  Continue<span className="hidden sm:inline"> to {guide?.next ?? "the next step"}</span> <ArrowRight />
                </Button>
              ) : (
                <Button type="submit" size="lg" variant="sun" disabled={busy} aria-label={busy ? "Holding your slot" : `Book it · pay ${dollars(DEPOSIT_CENTS)} deposit`} className={cn("min-w-0 flex-1 sm:flex-none", guide?.ready && !busy && "shadow-lift ring-2 ring-sun ring-offset-2 ring-offset-background")}>
                  {busy ? <><Loader2 className="animate-spin" aria-hidden="true" /> Holding your slot…</> : <><LockKeyhole aria-hidden="true" /> <span className="sm:hidden" aria-hidden="true">{`Pay ${dollars(DEPOSIT_CENTS)} & book`}</span><span className="hidden sm:inline" aria-hidden="true">{`Book it · pay ${dollars(DEPOSIT_CENTS)} deposit`}</span></>}
                </Button>
              )}
            </div>
          </div>
        </form>

        <Summary form={form} q={q} zone={zone} covered={covered} />
      </div>
    </div>
  );
}

/** Shown when the booking started from the natural-language box: what we read, so it's clear it was heard. */
function FromMessage({ ask }: { ask: Ask }) {
  const parsed = useMemo(() => parseInquiry(ask.message, nowMs()), [ask.message]);
  const chips = understood(parsed);
  return (
    <section aria-label="What we read from your message" className="iris-border mb-8 rounded-lg p-4 md:p-5">
      <p className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-sun-ink" aria-hidden="true" /> We read your message and filled in the form</p>
      <blockquote className="mt-2 border-l-4 border-sun pl-3 text-[0.95rem] italic text-foreground/85">“{ask.message}”</blockquote>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What we understood">
          {chips.map((c) => <li key={c.key} className="chip border-fern/30 bg-fern-soft text-fern-ink">{c.label}</li>)}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted-foreground">Change anything below. Times shown already include Dario's drive between jobs{parsed.zone ? "" : ", once we know your zip"}, and we're showing dry days first.</p>
    </section>
  );
}

function ReviewCard({ form, q, zone, onChangeTime }: { form: Form; q: ReturnType<typeof quote>; zone: NonNullable<ReturnType<typeof zoneForZip>>; onChangeTime: () => void }) {
  const state = useStore();
  const start = form.startMs!;
  const end = start + q.durationMin * 60_000;
  const deal = neighbourDeal(state, { startMs: start, durationMin: q.durationMin, zone });
  const total = q.totalCents - (deal?.discountCents ?? 0);
  const covered = form.parking ? isCovered(form.parking) : false;
  const rows: [string, React.ReactNode][] = [
    ["Service", <>{SERVICES[form.service!].name}{form.addons.length > 0 && <span className="text-muted-foreground"> + {form.addons.map((a) => ADDONS[a].name.toLowerCase()).join(", ")}</span>}</>],
    ["Vehicle", form.label ? <span className="capitalize">{form.label}</span> : VEHICLES[form.vehicle!].name],
    ["Where", <>{form.address}, {ZONES[zone].name}</>],
    ["Parking", <span className={covered ? "text-fern-ink" : "text-rain"}>{PARKING[form.parking!].name} · {covered ? "covered, not weather-sensitive" : "outdoors, weather-sensitive"}</span>],
    ...(form.plan ? [["Care plan", <>Every {form.plan} weeks: the next visit is booked for you after each one, {Math.round(PLAN_DISCOUNT * 100)}% off, no deposit after this first visit</>] as [string, React.ReactNode]] : []),
    ["Time window", <><strong>{fmtDayLong(start)}</strong>, {fmtTime(start)} to about {fmtTime(end)} <span className="text-muted-foreground">({hoursLabel(q.durationMin)} on site)</span></>],
  ];
  return (
    <section aria-label="Review your booking" className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-5 py-3">
        <h3 className="font-display text-lg font-extrabold">Check it over</h3>
        <button type="button" onClick={onChangeTime} className="text-sm font-semibold text-fern underline underline-offset-4">Change time</button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-[7.5rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="eyebrow pt-0.5">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t bg-muted/40 px-5 py-4 text-sm" role="group" aria-label="Price breakdown">
        <dl className="space-y-1.5">
          <div className="flex justify-between"><dt>{SERVICES[form.service!].name}</dt><dd className="tabular-nums">{dollars(q.serviceCents)}</dd></div>
          {form.addons.map((a) => <div key={a} className="flex justify-between"><dt>{ADDONS[a].name}</dt><dd className="tabular-nums">{dollars(ADDONS[a].cents)}</dd></div>)}
          {q.feeCents > 0 && <div className="flex justify-between"><dt>Travel ({ZONES[zone].name})</dt><dd className="tabular-nums">{dollars(q.feeCents)}</dd></div>}
          {deal && <div className="flex justify-between text-fern-ink"><dt className="font-semibold">Neighbour deal</dt><dd className="font-semibold tabular-nums">−{dollars(deal.discountCents)}</dd></div>}
          <div className="flex justify-between border-t pt-2 text-base"><dt className="font-bold">Total</dt><dd className="font-display text-xl font-extrabold tabular-nums">{dollars(total)}</dd></div>
        </dl>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border-2 border-primary bg-fern-soft px-3 py-2 text-fern-ink">
            <dt className="eyebrow !text-fern-ink">Due now</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">{dollars(DEPOSIT_CENTS)}</dd>
            <dd className="text-xs">deposit, taken off your total</dd>
          </div>
          <div className="rounded-md border bg-card px-3 py-2">
            <dt className="eyebrow">Due on the day</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">{dollars(Math.max(0, total - DEPOSIT_CENTS))}</dd>
            <dd className="text-xs text-muted-foreground">paid after the job, by card or cash</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function WaitlistForm({ form, set, onSubmit, done, error }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; onSubmit: (e: React.FormEvent) => void; done: boolean; error: string | null }) {
  if (done) return <p role="status" className="mt-4 font-semibold text-fern-ink">You're on the waitlist. We'll text you when a slot opens.</p>;
  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 text-left sm:grid-cols-3" noValidate>
      <Input aria-label="Your name" placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
      <Input aria-label="Mobile number" placeholder="Mobile number" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
      <Input aria-label="Email" placeholder="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
      {error && <p role="alert" className="text-sm font-medium text-danger sm:col-span-3">{error}</p>}
      <Button type="submit" variant="default" className="sm:col-span-3">Join the waitlist</Button>
    </form>
  );
}

function Summary({ form, q, zone, covered }: { form: Form; q: ReturnType<typeof quote> | null; zone: ReturnType<typeof zoneForZip>; covered: boolean }) {
  const state = useStore();
  const deal = q && zone && form.startMs ? neighbourDeal(state, { startMs: form.startMs, durationMin: q.durationMin, zone }) : null;
  const total = q ? q.totalCents - (deal?.discountCents ?? 0) : 0;
  return (
    <aside aria-label="Your booking" className="lg:sticky lg:top-24 lg:self-start">
      <div className="card overflow-hidden">
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <p className="eyebrow !text-primary-foreground/70">Your detail</p>
          <ul className="mt-2 space-y-2">
            {[
              { done: !!form.vehicle, label: "Car", text: form.vehicle ? (form.label || VEHICLES[form.vehicle].name) : "Not chosen yet" },
              { done: !!form.service, label: "Service", text: form.service ? SERVICES[form.service].name : "Not chosen yet" },
            ].map((row) => (
              <li key={`${row.label}-${row.text}`} className="flex items-center gap-2.5 animate-rise-in">
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", row.done ? "bg-sun text-sun-ink" : "border border-dashed border-primary-foreground/50")} aria-hidden="true">{row.done && <Check className="size-3" />}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">{row.label}</span>
                <span className={cn("font-display text-lg leading-tight", row.done ? "font-bold" : "text-base font-medium text-primary-foreground/70")}>{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 p-5 text-sm">
          {q ? (
            <>
              <dl className="space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted-foreground">{SERVICES[form.service!].name}</dt><dd className="font-semibold">{dollars(q.serviceCents)}</dd></div>
                {form.addons.map((a) => <div key={a} className="flex justify-between"><dt className="text-muted-foreground">{ADDONS[a].name}</dt><dd className="font-semibold">{dollars(ADDONS[a].cents)}</dd></div>)}
                {zone && q.feeCents > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Travel ({ZONES[zone].name})</dt><dd className="font-semibold">{dollars(q.feeCents)}</dd></div>}
                {deal && <div className="flex justify-between text-fern"><dt className="font-semibold">Neighbour deal</dt><dd className="font-bold">−{dollars(deal.discountCents)}</dd></div>}
                <div className="flex justify-between border-t pt-2 text-base"><dt className="font-bold">Total</dt><dd className="font-display text-lg font-extrabold">{dollars(total)}</dd></div>
              </dl>
              <p className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" aria-hidden="true" /> About {hoursLabel(q.durationMin)} on site</p>
            </>
          ) : <p className="text-muted-foreground">Pick your car and a service to see the price and how long it takes.</p>}
          {form.address && zone && <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {form.address}, {ZONES[zone].name}</p>}
          {form.parking && <p className="flex items-start gap-2 text-muted-foreground">{covered ? <Umbrella className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden="true" />} {PARKING[form.parking].name}: {covered ? "rain won't move you" : "we watch the forecast for you"}</p>}
          {form.startMs && <p className="rounded-md bg-sun-soft px-3 py-2 font-semibold text-sun-ink">{fmtDayLong(form.startMs)} at {fmtTime(form.startMs)}</p>}
          <p className="text-xs text-muted-foreground">{dollars(DEPOSIT_CENTS)} deposit at booking, applied to your total.</p>
        </div>
      </div>
    </aside>
  );
}
