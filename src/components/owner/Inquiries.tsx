import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { bookingLink, parseInquiry } from "@/lib/inquiry";
import type { Inquiry, State } from "@/lib/model";
import { actions } from "@/lib/store";
import { fmtStamp } from "@/lib/time";
import { cn } from "@/lib/utils";

export const EXAMPLES = [
  "Hey, do you do Subarus? Filthy inside from my dog, need it before Saturday. I'm in Sellwood",
  "Can I get my minivan done tomorrow morning? 97007",
  "My truck's caked in mud after the coast, Beaverton, this weekend if possible",
  "Do you do ceramic coating? Just bought a Tesla, Pearl district",
];

export function Inquiries({ state, now }: { state: State; now: number }) {
  const [text, setText] = useState("");
  const [latest, setLatest] = useState<string | null>(null);
  const send = (t: string) => {
    if (!t.trim()) return;
    const q = actions.inquire("You (demo)", t.trim());
    setLatest(q.id);
    setText("");
  };
  return (
    <section aria-label="Inquiries" className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-muted-foreground">Every "can you do my car?" gets a real answer in seconds: price, duration, three open times that fit the drive, and a link that opens the booking already filled in.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="card space-y-3 p-5">
        <label htmlFor="try" className="text-sm font-bold">Try it: write to Fernhill like a customer would</label>
        <Textarea id="try" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="e.g. my dog wrecked my Outback, I'm in Sellwood, Friday morning?" />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="max-w-full truncate rounded-full border bg-card px-3 py-1 text-left text-xs font-medium hover:border-foreground/50">{ex}</button>
          ))}
        </div>
        <Button type="submit" disabled={!text.trim()}><Send /> Send</Button>
      </form>
      <ul className="space-y-5">
        {state.inquiries.filter((q) => q.at <= now + 60_000).map((q) => <InquiryRow key={q.id} q={q} highlight={q.id === latest} />)}
      </ul>
    </section>
  );
}

function InquiryRow({ q, highlight }: { q: Inquiry; highlight: boolean }) {
  const p = parseInquiry(q.text, q.at);
  const link = bookingLink({ ...p, startMs: q.suggested[0] });
  return (
    <li className={cn("card space-y-3 p-5", highlight && "ring-2 ring-sun")}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">{q.from} <span className="font-normal text-muted-foreground">· {fmtStamp(q.at)} · replied instantly</span></p>
        <span className={cn("chip", q.status === "booked" ? "border-fern/30 bg-fern-soft text-fern-ink" : q.status === "needs_owner" ? "border-sun/50 bg-sun-soft text-sun-ink" : "border-border bg-muted")}>
          {q.status === "booked" ? "Turned into a booking" : q.status === "needs_owner" ? "Needs you" : "Answered"}
        </span>
      </div>
      <p className="ml-auto max-w-[34rem] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground [overflow-wrap:anywhere]">{q.text}</p>
      <p className="max-w-[38rem] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-fern-soft px-4 py-2.5 text-fern-ink [overflow-wrap:anywhere]">{q.reply}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {q.jobId ? null : q.status !== "needs_owner" && <Link to={link} className="inline-flex items-center gap-1.5 font-semibold text-fern underline underline-offset-4">Open the booking they'd get <ArrowRight className="size-4" aria-hidden="true" /></Link>}
        {q.note && <span className="text-muted-foreground">{q.note}</span>}
        {q.status === "needs_owner" && <Button size="sm" variant="soft" onClick={() => actions.resolveInquiry(q.id)}>Mark handled</Button>}
      </div>
    </li>
  );
}
