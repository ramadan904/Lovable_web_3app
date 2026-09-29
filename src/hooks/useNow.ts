import { useEffect, useState } from "react";
import { nowMs, useStore } from "@/lib/store";

/** The business's "now": real time plus the demo clock, refreshed every 30 seconds. */
export function useNow(): number {
  useStore();
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return nowMs();
}
