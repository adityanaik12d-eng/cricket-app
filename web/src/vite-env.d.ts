/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcdefgh.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase public (anon / publishable) key — safe to ship in the browser. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
