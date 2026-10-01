/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Show the demo guide panel even when a real backend is configured. */
  readonly VITE_SHOW_DEMO_GUIDE?: string;
  /** On-chain deposits (docs/ONCHAIN.md): the escrow contract and the stablecoin it takes. Both are required. */
  readonly VITE_ESCROW_ADDRESS?: string;
  readonly VITE_TOKEN_ADDRESS?: string;
  readonly VITE_TOKEN_SYMBOL?: string;
  readonly VITE_TOKEN_DECIMALS?: string;
  /** 421614 (Arbitrum Sepolia, the default) or 42161 (Arbitrum One). */
  readonly VITE_CHAIN_ID?: string;
}
