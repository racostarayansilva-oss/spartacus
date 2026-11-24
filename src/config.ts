// Endereço e chave pública do Supabase. Na Vercel vêm do build (VITE_*); no servidor próprio (VPS)
// vêm de /config.js, gerado pelo servidor na hora a partir das variáveis de ambiente.
const rt = ((globalThis as any).SPARTACUS_CONFIG || (globalThis as any).RA_CONFIG || {}) as {
  supabaseUrl?: string; supabaseAnonKey?: string; dominioPlataforma?: string;
};

export const SUPABASE_URL: string = rt.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY: string = rt.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
/** Domínio da plataforma (ex.: spartacus.adv.br). Os escritórios ficam em slug.spartacus.adv.br ou no domínio próprio. */
export const DOMINIO_PLATAFORMA: string = rt.dominioPlataforma || import.meta.env.VITE_DOMINIO_PLATAFORMA || '';
