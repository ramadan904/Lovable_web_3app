import { useState } from "react";
import { MessageSquareDashed } from "lucide-react";
import { EmptyState } from "../EmptyState";
import { Bubble } from "../PhoneThread";
import type { Message, State } from "@/lib/model";
import { cn } from "@/lib/utils";

const FILTERS: { key: string; label: string; test: (m: Message) => boolean }[] = [
  { key: "all", label: "Everything", test: () => true },
  { key: "out", label: "Sent for you", test: (m) => m.direction === "out" },
  { key: "in", label: "Customer replies", test: (m) => m.direction === "in" },
  { key: "rain", label: "Rain", test: (m) => m.kind === "rain_offer" || m.kind === "rain_moved" },
  { key: "wait", label: "Waitlist & releases", test: (m) => m.kind === "waitlist_offer" || m.kind === "released" },
];

export function MessagesLog({ state, now }: { state: State; now: number }) {
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(25);
  const f = FILTERS.find((x) => x.key === filter)!;
  const all = state.messages.filter((m) => m.at <= now && f.test(m)).sort((a, b) => b.at - a.at);
  return (
    <section aria-label="Message log" className="space-y-4">
      <p className="max-w-2xl text-muted-foreground">Every text and email Fernhill sent in Dario's name, with the words used. He writes none of them. In production these go out through Twilio and Resend.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter messages">
        {FILTERS.map((x) => (
          <button key={x.key} type="button" aria-pressed={filter === x.key} onClick={() => { setFilter(x.key); setLimit(25); }}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", filter === x.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/50")}>
            {x.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-4" aria-live="polite">
        {all.slice(0, limit).map((m) => <Bubble key={m.id} m={m} showTo />)}
      </ul>
      {all.length > limit && <button type="button" className="font-semibold text-fern underline underline-offset-4" onClick={() => setLimit(limit + 25)}>Show older messages ({all.length - limit} more)</button>}
      {!all.length && (
        <EmptyState icon={MessageSquareDashed} title={filter === "all" ? "No messages yet" : "Nothing in this filter yet"}>
          Every reminder, rain offer and reply Fernhill sends in Dario's name lands here. Book something, or use the demo controls to fast-forward.
        </EmptyState>
      )}
    </section>
  );
}
