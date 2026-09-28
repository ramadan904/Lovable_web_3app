import { supabase } from "@/integrations/supabase/client";
import type { ThresholdApi } from "./api";
import { createDemoApi } from "./demo";
import { createSupabaseApi } from "./supabase";

/** One backend for the whole app: Supabase when configured, the seeded demo store otherwise. */
export const api: ThresholdApi = supabase ? createSupabaseApi(supabase) : createDemoApi();

export type { ThresholdApi };
