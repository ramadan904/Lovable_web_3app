import type { ThresholdApi } from "./api";
import { createDemoApi } from "./demo";

const configured = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
);

/**
 * Supabase is loaded on first use, in its own chunk, so the demo build never
 * ships supabase-js and the first paint stays light either way.
 */
function lazySupabaseApi(): ThresholdApi {
  let loading: Promise<ThresholdApi> | null = null;
  const load = () =>
    (loading ??= Promise.all([import("@/integrations/supabase/client"), import("./supabase")]).then(([c, s]) =>
      s.createSupabaseApi(c.supabase!),
    ));

  return new Proxy({} as ThresholdApi, {
    get(_, key: string) {
      if (key === "mode") return "supabase";
      if (key === "resetDemo" || key === "then") return undefined;
      if (key === "onAuthChange") {
        return (cb: Parameters<ThresholdApi["onAuthChange"]>[0]) => {
          let off = () => {};
          let closed = false;
          void load().then((a) => {
            if (!closed) off = a.onAuthChange(cb);
          });
          return () => {
            closed = true;
            off();
          };
        };
      }
      return (...args: unknown[]) =>
        load().then((a) => (a[key as keyof ThresholdApi] as (...x: unknown[]) => unknown)(...args));
    },
  });
}

/** One backend for the whole app: Supabase when configured, the seeded demo store otherwise. */
export const api: ThresholdApi = configured ? lazySupabaseApi() : createDemoApi();

export type { ThresholdApi };
