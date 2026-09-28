import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useDemoEntry } from "@/hooks/useDemoEntry";
import { clearRitual } from "@/hooks/useRitual";
import { api } from "@/lib/data";
import { cn } from "@/lib/utils";

const OPEN_KEY = "threshold.demo-guide.open";
/** The seeded letter Inês wrote before leaving her career — already unsealed. */
const UNSEALED_LETTER = "30000000-0000-4000-8000-000000000001";

const enabled = api.mode === "demo" || import.meta.env.VITE_SHOW_DEMO_GUIDE === "true";

/**
 * A quiet companion for anyone evaluating Threshold: the four paths worth
 * seeing, one tap each. Stays out of the ritual and the letter, where
 * nothing should interrupt.
 */
export function DemoGuide() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enter, busy } = useDemoEntry();
  const [open, setOpen] = useState(() => {
    try {
      // Starts as a small pill so the first seconds belong to the product itself.
      return localStorage.getItem(OPEN_KEY) === "open";
    } catch {
      return false;
    }
  });
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled || pathname.startsWith("/begin") || pathname.startsWith("/letters")) return null;

  const go = async (id: string, fn: () => Promise<unknown>) => {
    setWorking(id);
    try {
      await fn();
    } finally {
      setWorking(null);
    }
  };

  const paths = [
    {
      id: "ritual",
      title: "Walk the Booking Ritual",
      line: "As a guest, from the first question to the held hour. About two minutes.",
      run: async () => {
        clearRitual();
        await api.signOut();
        await qc.invalidateQueries();
        navigate("/begin");
      },
    },
    {
      id: "record",
      title: "Open a client's record",
      line: "Inês: one threshold crossed, one held, one letter still sealed.",
      run: async () => (await enter("client")) && navigate("/record"),
    },
    {
      id: "letter",
      title: "Read an unsealed letter",
      line: "What Inês wrote to herself before leaving a 26-year career.",
      run: async () => (await enter("client")) && navigate(`/letters/${UNSEALED_LETTER}`),
    },
    {
      id: "guide",
      title: "See a Guide's week",
      line: "Mara: sessions, the 45-minute stillness around each, and briefings.",
      run: async () => (await enter("guide")) && navigate("/guide"),
    },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-40 md:bottom-6 md:left-6">
      {open ? (
        <div
          role="region"
          aria-label="Demo guide"
          className="w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-bone/10 bg-charcoal-850/95 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md animate-rise-in"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-copper-bright animate-breathe" aria-hidden />
                Demo guide
              </p>
              <p className="mt-2 text-xs leading-relaxed text-bone-faint">
                {api.mode === "demo" ? "Seeded, fictional data — in your browser. Nothing leaves this device." : "Seeded, fictional accounts on a live backend."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 rounded-full p-1.5 text-bone-faint transition-colors duration-500 hover:text-bone"
              aria-label="Close demo guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ol className="space-y-1">
            {paths.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!!working || !!busy}
                  onClick={() => go(p.id, p.run)}
                  className="group flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors duration-500 hover:bg-bone/[0.04] disabled:opacity-60"
                >
                  <span className="mt-0.5 w-4 shrink-0 font-serif text-sm text-copper-bright">{i + 1}</span>
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm text-bone">
                      {p.title}
                      {working === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-bone-faint" aria-hidden />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-bone-faint opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-bone-faint">{p.line}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {api.resetDemo && (
            <button
              type="button"
              disabled={!!working}
              onClick={() =>
                go("reset", async () => {
                  await api.resetDemo?.();
                  clearRitual();
                  await qc.invalidateQueries();
                  toast("The demo has been returned to its first day.");
                  navigate("/");
                })
              }
              className="mt-3 w-full border-t border-bone/[0.07] pt-3 text-left text-xs text-bone-faint underline-offset-4 transition-colors duration-500 hover:text-bone-dim hover:underline"
            >
              Reset the demo
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className={cn(
            "flex items-center gap-2 rounded-full border border-bone/10 bg-charcoal-850/90 px-4 py-2 text-xs text-bone-dim shadow-xl backdrop-blur-md transition-colors duration-500 hover:border-bone/25 hover:text-bone animate-fade-in",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-copper-bright animate-breathe" aria-hidden />
          Demo guide <span className="text-bone-faint">· 4 paths</span>
        </button>
      )}
    </div>
  );
}
