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
  // With reduced motion the new view is rendered immediately — never a frame of the old one.
  const instant = prefersReducedMotion();
  const leaving = !instant && viewKey !== displayKey;

  if (!leaving) last.current = children;

  useEffect(() => {
    if (viewKey === displayKey) return;
    const arrive = () => {
      setDisplayKey(viewKey);
      onSwap?.();
      requestAnimationFrame(() => {
        ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
      });
    };
    if (instant) {
      arrive();
      return;
    }
    const t = setTimeout(arrive, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, displayKey]);

  return (
    <div
      ref={ref}
      className={
        leaving
          ? "translate-y-1 opacity-0 transition-[opacity,transform] duration-300 ease-quiet"
          : "translate-y-0 opacity-100 transition-[opacity,transform] duration-700 ease-quiet"
      }
    >
      <div key={String(instant ? viewKey : displayKey)} className="animate-rise-in">
        {leaving ? last.current : children}
      </div>
    </div>
  );
}
