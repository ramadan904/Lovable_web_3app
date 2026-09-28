import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Cross-fades between keyed views: the old one leaves quietly before the new
 * one arrives. Focus moves to the new view's heading for screen readers.
 * While the key is unchanged, children render live (no lag while typing).
 */
export function FadeSwap({ viewKey, children, onSwap }: { viewKey: string | number; children: ReactNode; onSwap?: () => void }) {
  const [displayKey, setDisplayKey] = useState(viewKey);
  const last = useRef<ReactNode>(children);
  const ref = useRef<HTMLDivElement>(null);
  const leaving = viewKey !== displayKey;

  if (!leaving) last.current = children;

  useEffect(() => {
    if (!leaving) return;
    // With reduced motion, the new view arrives at once; there is nothing to wait for.
    const t = setTimeout(() => {
      setDisplayKey(viewKey);
      onSwap?.();
      requestAnimationFrame(() => {
        ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
      });
    }, prefersReducedMotion() ? 0 : 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, leaving]);

  return (
    <div
      ref={ref}
      className={
        leaving
          ? "translate-y-1 opacity-0 transition-[opacity,transform] duration-300 ease-quiet"
          : "translate-y-0 opacity-100 transition-[opacity,transform] duration-700 ease-quiet"
      }
    >
      <div key={String(displayKey)} className="animate-rise-in">
        {leaving ? last.current : children}
      </div>
    </div>
  );
}
