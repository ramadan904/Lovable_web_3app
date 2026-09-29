import { Toaster as Sonner } from "sonner";

export const Toaster = () => (
  <Sonner
    position="top-center"
    toastOptions={{
      classNames: {
        toast: "!rounded-lg !border !border-border !bg-card !text-foreground !shadow-lift !font-sans",
        description: "!text-muted-foreground",
      },
    }}
  />
);
