import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/**
 * The Supabase client, or null when no project is configured.
 * Without one, Threshold runs its seeded in-browser demo store instead.
 *
 * import { supabase } from "@/integrations/supabase/client";
 */
export const supabase: SupabaseClient<Database> | null =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
