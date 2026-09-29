import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-center"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          "group toast !rounded-md !border !border-bone/10 !bg-charcoal-800 !text-bone !shadow-2xl !font-sans !text-[0.875rem]",
        description: "!text-bone-dim",
        actionButton: "!bg-bone !text-charcoal-950",
        cancelButton: "!bg-charcoal-700 !text-bone-dim",
      },
    }}
    {...props}
  />
);

export { Toaster };
