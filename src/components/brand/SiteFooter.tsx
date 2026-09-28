import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BuiltWithLovable } from "./BuiltWithLovable";
import { Mark } from "./Mark";
import { api } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";

export function SiteFooter() {
  const qc = useQueryClient();
  return (
    <footer className="relative border-t border-bone/[0.07]">
      <div className="container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:py-20">
        <div className="max-w-sm space-y-5">
          <Mark className="h-7 w-7" />
          <p className="text-sm leading-relaxed text-bone-dim">
            Threshold holds the moments that do not reverse. It is not therapy, and it is not a crisis service.
          </p>
          <p className="text-sm leading-relaxed text-bone-faint">
            If you are in danger or thinking of ending your life, please contact your local emergency number, or find a
            free, confidential line at{" "}
            <a className="text-bone-dim underline decoration-bone/20 underline-offset-4 hover:text-bone" href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </p>
        </div>
        <nav aria-label="Footer" className="space-y-3 text-sm">
          <p className="eyebrow mb-5">Threshold</p>
          <Link className="block text-bone-dim transition-colors duration-500 hover:text-bone" to="/begin">Begin the ritual</Link>
          <Link className="block text-bone-dim transition-colors duration-500 hover:text-bone" to="/guides">The Guides</Link>
          <Link className="block text-bone-dim transition-colors duration-500 hover:text-bone" to="/record">My thresholds</Link>
          <Link className="block text-bone-dim transition-colors duration-500 hover:text-bone" to="/guide">For Guides</Link>
        </nav>
        <div className="space-y-5 text-sm">
          <p className="eyebrow mb-5">Made with care</p>
          <BuiltWithLovable />
          {api.mode === "demo" && (
            <div className="space-y-2 text-xs leading-relaxed text-bone-faint">
              <p>Demonstration data. Every person here is fictional.</p>
              <button
                type="button"
                className="underline decoration-bone/20 underline-offset-4 transition-colors duration-500 hover:text-bone-dim"
                onClick={async () => {
                  await api.resetDemo?.();
                  try {
                    localStorage.removeItem("threshold.ritual");
                  } catch {
                    /* ignore */
                  }
                  await qc.invalidateQueries();
                  toast("The demo has been returned to its first day.");
                }}
              >
                Reset the demo
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
