import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/data";
import { DEMO_USERS } from "@/lib/data/seed";

/** One-tap entry to the seeded demo accounts (present in both demo and Supabase seeds). */
export function useDemoEntry() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"client" | "guide" | null>(null);

  const enter = async (who: "client" | "guide") => {
    setBusy(who);
    try {
      const u = DEMO_USERS[who];
      await api.signIn(u.email, u.password);
      await qc.invalidateQueries();
      return true;
    } catch {
      toast("The demo account isn't available on this backend.", { description: "Run supabase/seed.sql to create it." });
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { enter, busy };
}
