import { cn } from "@/lib/utils";

/** A quiet credit. Present, never loud. */
export function BuiltWithLovable({ className }: { className?: string }) {
  return (
    <a
      href="https://lovable.dev"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-bone/10 px-3.5 py-1.5 text-xs text-bone-faint transition-colors duration-700 ease-quiet hover:border-bone/25 hover:text-bone-dim",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
        <path
          d="M8 14s-5.5-3.2-5.5-7.1C2.5 4.8 4 3.5 5.6 3.5c1.1 0 1.9.6 2.4 1.4.5-.8 1.3-1.4 2.4-1.4 1.6 0 3.1 1.3 3.1 3.4C13.5 10.8 8 14 8 14Z"
          className="fill-copper/70 transition-colors duration-700 group-hover:fill-copper-bright"
        />
      </svg>
      Built with Lovable
    </a>
  );
}
