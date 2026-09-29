import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { SERVICES, dollars, hoursLabel, quote } from "@/lib/business";
import { BookingError } from "@/lib/model";
import { actions, useStore } from "@/lib/store";
import { fmtDayLong, fmtRelative, fmtTime } from "@/lib/time";

export default function Claim() {
  const { id = "" } = useParams();
  const state = useStore();
  const now = useNow();
  const nav = useNavigate();
  const entry = state.waitlist.find((w) => w.id === id);
  const live = entry && entry.status === "offered" && entry.offer && entry.offer.expiresAt > now ? entry.offer : null;

  if (!entry) {
    return (
      <div className="container max-w-xl py-20 text-center">
        <h1 className="text-3xl font-extrabold">We can't find that offer</h1>
        <Button asChild className="mt-6"><Link to="/book">Book a detail</Link></Button>
      </div>
    );
  }
  if (!live) {
    return (
      <div className="container max-w-xl py-20 text-center">
        <h1 className="text-3xl font-extrabold">{entry.status === "booked" ? "You've got it" : "That time has gone"}</h1>
        <p className="mt-3 text-muted-foreground">{entry.status === "booked" ? "You already claimed this slot. Check your text for the details." : "Offers last two hours, so the slot has moved on to the next person. You're still on the waitlist for the next opening."}</p>
        <Button asChild className="mt-6"><Link to="/book">Book a different time</Link></Button>
      </div>
    );
  }
  const q = quote(entry.vehicle.kind, entry.service, entry.addons, entry.zone);
  const claim = () => {
    try {
      const job = actions.claim(entry.id);
      nav(`/b/${job.code}?new=1`);
    } catch (e) {
      if (e instanceof BookingError) toast.error(e.message); else throw e;
    }
  };
  return (
    <div className="container max-w-xl py-12">
      <div className="card overflow-hidden">
        <div className="bg-sun px-6 py-4 text-sun-ink">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"><Zap className="size-4" aria-hidden="true" /> A time just opened</p>
          <p className="text-sm">Yours if you claim it {fmtRelative(now, live.expiresAt)}.</p>
        </div>
        <div className="space-y-4 p-6">
          <h1 className="text-3xl font-extrabold">{fmtDayLong(live.startMs)}, {fmtTime(live.startMs)}</h1>
          <p className="text-lg">{SERVICES[entry.service].name} for your {entry.vehicle.label}, at {entry.address}.</p>
          <p className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" aria-hidden="true" /> About {hoursLabel(q.durationMin)} · {dollars(q.totalCents)} · {dollars(2500)} deposit comes off the total</p>
          <Button size="lg" variant="sun" onClick={claim} className="w-full">Claim this time</Button>
          <p className="text-center text-xs text-muted-foreground">Demo: no card is charged.</p>
        </div>
      </div>
    </div>
  );
}
