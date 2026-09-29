import { useState } from "react";
import { AlertCircle, Pencil, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { draftForFlag, draftForInquiry } from "@/lib/drafts";
import { ACTIVE, type State } from "@/lib/model";
import { actions } from "@/lib/store";

interface ItemProps {
  id: string;
  who: string;
  what: React.ReactNode;
  draft: string;
  callHref?: string;
  onSend: (body: string) => void;
}

/** One thing that needs Dario, with the reply already written. */
function Item({ id, who, what, draft, callHref, onSend }: ItemProps) {
  const [text, setText] = useState(draft);
  const [editing, setEditing] = useState(false);
  return (
    <li className="space-y-3 rounded-md bg-card p-4">
      <p className="text-sm"><strong>{who}:</strong> {what}</p>
      <div className="space-y-2">
        <p className="eyebrow">Drafted reply</p>
        {editing ? (
          <>
            <label htmlFor={`draft-${id}`} className="sr-only">Reply to {who}</label>
            <Textarea id={`draft-${id}`} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          </>
        ) : (
          <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-fern-soft px-4 py-3 text-sm text-fern-ink [overflow-wrap:anywhere]">{text}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSend(text)}><Send /> Send this reply</Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}><Pencil /> {editing ? "Done editing" : "Edit first"}</Button>
        {callHref && <Button size="sm" variant="ghost" asChild><a href={callHref}><Phone /> Call instead</a></Button>}
      </div>
    </li>
  );
}

/** "Needs you": only what a person has to handle, each with a one-tap drafted reply. */
export function NeedsYou({ state }: { state: State }) {
  const flagged = state.jobs.filter((j) => ACTIVE.includes(j.status) && j.ownerFlag);
  const asks = state.inquiries.filter((q) => q.status === "needs_owner");
  const total = flagged.length + asks.length;
  if (!total) return null;
  const sent = (who: string) => toast.success(`Reply sent to ${who}`, { description: "It's in their thread and cleared from your queue." });
  return (
    <section aria-labelledby="needs-h" className="mb-8 rounded-lg border border-sun/60 bg-sun-soft p-5">
      <h2 id="needs-h" className="flex items-center gap-2 text-lg font-bold text-sun-ink"><AlertCircle className="size-5" aria-hidden="true" /> Needs you ({total})</h2>
      <p className="mt-1 text-sm text-sun-ink/90">Everything else was handled. For these, the reply is already written: read it, tap send.</p>
      <ul className="mt-4 space-y-3">
        {flagged.map((j) => (
          <Item key={j.id} id={j.id} who={j.customer.name} what={j.ownerFlag} draft={draftForFlag(j)} callHref={`tel:${j.customer.phone.replace(/\D/g, "")}`}
            onSend={(body) => { actions.sendReply({ jobId: j.id }, body); sent(j.customer.name); }} />
        ))}
        {asks.map((q) => (
          <Item key={q.id} id={q.id} who={q.from} what={<>“{q.text}” <span className="text-muted-foreground">{q.note}</span></>} draft={draftForInquiry(q)} callHref={`tel:${q.from.replace(/\D/g, "")}`}
            onSend={(body) => { actions.sendReply({ inquiryId: q.id }, body); sent(q.from); }} />
        ))}
      </ul>
    </section>
  );
}
