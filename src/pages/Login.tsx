import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/brand/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoEntry } from "@/hooks/useDemoEntry";
import { api } from "@/lib/data";

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next");
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const demo = useDemoEntry();

  const goOn = (role: string) => navigate(next ?? (role === "guide" ? "/guide" : "/record"));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const u = await api.signIn(email, password);
        goOn(u.role);
      } else {
        const res = await api.signUp(email, password, name);
        if (res.needsConfirmation) setSentTo(email.trim());
        else goOn("client");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="container grid max-w-5xl gap-16 pb-28 pt-10 md:grid-cols-[1fr_22rem] md:gap-24 md:pt-20">
        <div className="max-w-md animate-rise-in">
          <p className="eyebrow mb-6">{mode === "signin" ? "Your record" : "A new record"}</p>
          <h1 className="font-serif text-5xl leading-none text-bone md:text-6xl">{mode === "signin" ? "Welcome back." : "Keep a record."}</h1>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-bone-dim">
            {mode === "signin"
              ? "Your sessions, your answers, and your sealed letters are waiting."
              : "You don't need one to begin — only to hold a time. You can also create it at the end of the ritual."}
          </p>

          {sentTo ? (
            <p role="status" className="mt-12 border-l border-copper pl-5 text-bone-dim">
              We've sent a link to <span className="text-bone">{sentTo}</span>. Open it to confirm your record.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-12 space-y-8" noValidate>
              {mode === "create" && (
                <div>
                  <Label htmlFor="name">What should we call you?</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className="mt-2" />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" required />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              {error && (
                <p role="alert" className="border-l border-destructive pl-4 text-sm text-[hsl(8_60%_72%)] animate-fade-in">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <Button type="submit" disabled={busy || !email || !password}>
                  {busy && <Loader2 className="animate-spin" aria-hidden />}
                  {mode === "signin" ? "Sign in" : "Create record"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "create" : "signin");
                    setError(null);
                  }}
                  className="text-sm text-bone-faint underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
                >
                  {mode === "signin" ? "I'm new here" : "I already have a record"}
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="self-start rounded-lg border border-bone/[0.08] p-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <p className="eyebrow mb-4">Explore the demo</p>
          <p className="text-sm leading-relaxed text-bone-dim">Two seeded, fictional accounts show both sides of Threshold.</p>
          <div className="mt-8 space-y-6">
            <div>
              <Button variant="outline" className="w-full" disabled={!!demo.busy} onClick={async () => (await demo.enter("client")) && navigate(next ?? "/record")}>
                {demo.busy === "client" && <Loader2 className="animate-spin" aria-hidden />} Enter as Inês
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-bone-faint">A client: one threshold crossed, one held, one letter unsealed.</p>
            </div>
            <div>
              <Button variant="outline" className="w-full" disabled={!!demo.busy} onClick={async () => (await demo.enter("guide")) && navigate("/guide")}>
                {demo.busy === "guide" && <Loader2 className="animate-spin" aria-hidden />} Enter as Mara
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-bone-faint">A Guide: her week, her buffers, and each session's briefing.</p>
            </div>
          </div>
          <p className="mt-8 border-t border-bone/[0.07] pt-6 text-xs text-bone-faint">
            Or simply <Link to="/begin" className="text-bone-dim underline underline-offset-4">begin as a guest</Link>.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
