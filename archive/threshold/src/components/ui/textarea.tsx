import * as React from "react";
import { cn } from "@/lib/utils";

/** Grows with its content so writing never feels boxed in. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea"> & { autoGrow?: boolean }>(
  ({ className, autoGrow = true, onInput, ...props }, ref) => {
    const inner = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

    const grow = React.useCallback(() => {
      const el = inner.current;
      if (!el || !autoGrow) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoGrow]);

    React.useLayoutEffect(grow, [grow, props.value]);

    return (
      <textarea
        ref={inner}
        onInput={(e) => {
          grow();
          onInput?.(e);
        }}
        className={cn(
          "flex min-h-[7rem] w-full resize-none border-0 border-b border-bone/15 bg-transparent px-0 py-3 text-lg leading-relaxed text-bone transition-colors duration-500 ease-quiet",
          "placeholder:text-bone-faint hover:border-bone/30 focus-visible:border-copper focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
