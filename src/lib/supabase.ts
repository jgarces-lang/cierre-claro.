import { createClient } from "@supabase/supabase-js";

// Le dice a TypeScript qué variables de entorno existen.
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  }
}

// Las llaves NO van escritas aquí: las entrega Vercel como variables de entorno.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key);
