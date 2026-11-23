// Login nas rotas /api. Quando o Supabase está configurado, toda chamada precisa do token da sessão.
// Sem Supabase (modo local de testes), as rotas ficam abertas.

import { ErroApi, env } from './http.js';

export type Papel = 'pendente' | 'advogado' | 'equipe' | 'cliente' | 'bloqueado';

export interface Sessao {
  id: string;
  nome: string;
  email?: string;
  papel: Papel;
  cpf?: string | null;
  token: string;
}

export function supabaseConfigurado(): { url: string; chave: string } | null {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const chave = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  return url && chave ? { url: url.replace(/\/$/, ''), chave } : null;
}

const cache = new Map<string, { sessao: Sessao; ate: number }>();

/** Chama a API REST do Supabase com o token do próprio usuário (as regras do banco valem). */
export async function supabaseRest(sessao: Sessao, caminho: string, init: RequestInit = {}): Promise<any> {
  const cfg = supabaseConfigurado();
  if (!cfg) throw new ErroApi(500, 'Supabase não configurado.');
  const r = await fetch(`${cfg.url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: cfg.chave,
      Authorization: `Bearer ${sessao.token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new ErroApi(502, `Banco respondeu ${r.status}`, texto.slice(0, 300));
  return texto ? JSON.parse(texto) : null;
}

/** Valida o token e devolve quem está logado. Retorna null quando o Supabase não está configurado. */
export async function autenticar(cabecalho: string | undefined): Promise<Sessao | null> {
  const cfg = supabaseConfigurado();
  if (!cfg) return null;
  const token = (cabecalho || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ErroApi(401, 'Faça login para usar o RA Connect.');

  const c = cache.get(token);
  if (c && c.ate > Date.now()) return c.sessao;

  let ru: Response;
  try {
    ru = await fetch(`${cfg.url}/auth/v1/user`, { headers: { apikey: cfg.chave, Authorization: `Bearer ${token}` } });
  } catch {
    throw new ErroApi(503, 'Não foi possível validar o login agora. Tente de novo.');
  }
  if (!ru.ok) throw new ErroApi(401, 'Sessão expirada. Entre de novo.');
  const user = await ru.json();

  const sessao: Sessao = { id: user.id, nome: user.email, email: user.email, papel: 'pendente', token };
  const perfis = await supabaseRest(sessao, `perfis?select=nome,papel,cpf&auth_id=eq.${user.id}`);
  const p = perfis?.[0];
  if (p) {
    sessao.nome = p.nome || user.email;
    sessao.papel = p.papel;
    sessao.cpf = p.cpf;
  }
  if (sessao.papel === 'pendente' || sessao.papel === 'bloqueado') {
    throw new ErroApi(403, 'Seu acesso ainda não foi liberado pelo administrador.');
  }
  cache.set(token, { sessao, ate: Date.now() + 60_000 });
  if (cache.size > 500) cache.clear();
  return sessao;
}

export function exigirEquipe(s: Sessao | null) {
  if (s && s.papel !== 'advogado' && s.papel !== 'equipe') throw new ErroApi(403, 'Recurso disponível só para a equipe do escritório.');
}

/** Só a conta de administrador (papel "advogado"). Sem login configurado (modo de testes), libera. */
export function exigirAdministrador(s: Sessao | null) {
  if (s && s.papel !== 'advogado') throw new ErroApi(403, 'Disponível só para a conta de administrador.');
}
