import { Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/model";
import { fmtStamp } from "@/lib/time";

const LABEL: Record<Message["kind"], string> = {
  confirmation: "Booking confirmation", prep: "Prep note", reminder: "Reminder", confirm_reply: "Customer reply", nudge: "Second nudge",
  released: "Slot released", rain_offer: "Rain offer", rain_moved: "Moved for rain", moved: "Moved by customer", cancelled: "Cancellation",
  waitlist_offer: "Waitlist offer", omw: "On the way", aftercare: "Aftercare", inquiry_reply: "Instant reply", inquiry_in: "Customer message",
};
export const kindLabel = (k: Message["kind"]) => LABEL[k];

export function Bubble({ m, showTo = false }: { m: Message; showTo?: boolean }) {
  const out = m.direction === "out";
  return (
    <li className={cn("flex min-w-0 max-w-full flex-col gap-1", out ? "items-start" : "items-end")}>
      <div className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-xs font-medium text-muted-foreground">
        {m.channel === "email" ? <Mail className="size-3" aria-label="Email" /> : <MessageSquare className="size-3" aria-label="Text message" />}
        <span>{LABEL[m.kind]}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(m.at).toISOString()}>{fmtStamp(m.at)}</time>
        {showTo && <span className="min-w-0 [overflow-wrap:anywhere]">· {out ? `to ${m.to}` : `from ${m.to}`}</span>}
      </div>
      <p
        className={cn(
          "max-w-[34rem] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-snug [overflow-wrap:anywhere]",
          out ? "rounded-tl-md bg-fern-soft text-fern-ink" : "rounded-tr-md bg-primary text-primary-foreground",
        )}
      >
        {m.body}
      </p>
    </li>
  );
}

export function PhoneThread({ messages, showTo = false, empty }: { messages: Message[]; showTo?: boolean; empty?: string }) {
  if (!messages.length) return <p className="text-sm text-muted-foreground">{empty ?? "Nothing sent yet."}</p>;
  return <ul className="flex flex-col gap-3" aria-label="Messages">{messages.map((m) => <Bubble key={m.id} m={m} showTo={showTo} />)}</ul>;
}
