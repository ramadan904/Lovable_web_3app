/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Show the demo guide panel even when a real backend is configured. */
  readonly VITE_SHOW_DEMO_GUIDE?: string;
}
