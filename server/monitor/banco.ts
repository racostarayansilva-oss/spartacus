// Acesso do monitor ao Supabase com a chave SECRETA (só no servidor próprio, em SUPABASE_SECRET_KEY).
// Ela ignora as regras de acesso (RLS): nunca vai para o navegador nem para o /config.js.
import { env } from '../http.js';

const url = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '');
const chave = () => env('SUPABASE_SECRET_KEY');

export const bancoMonitorConfigurado = () => !!(url() && chave());

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  const k = chave();
  // Chave nova (sb_secret_…) vai só em apikey; a antiga (JWT service_role) também no Authorization.
  return { apikey: k, ...(k.split('.').length === 3 ? { Authorization: `Bearer ${k}` } : {}), 'Content-Type': 'application/json', ...extra };
}

async function rest(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${url()}/rest/v1/${caminho}`, { ...init, headers: cabecalhos(init.headers as Record<string, string>), signal: AbortSignal.timeout(60_000) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} em ${caminho.split('?')[0]}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Todas as linhas (coluna dados) de uma coleção. */
export async function lerColecao<T>(tabela: string): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const linhas: { dados: T }[] = await rest(`${tabela}?select=dados&order=id&limit=1000&offset=${de}`);
    todas.push(...linhas.map((l) => l.dados));
    if (linhas.length < 1000) return todas;
  }
}

export async function lerIds(tabela: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let de = 0; ; de += 1000) {
    const linhas: { id: string }[] = await rest(`${tabela}?select=id&order=id&limit=1000&offset=${de}`);
    linhas.forEach((l) => ids.add(l.id));
    if (linhas.length < 1000) return ids;
  }
}

export async function lerConfig(): Promise<any> {
  const linhas = await rest('config?select=dados&id=eq.escritorio');
  return linhas?.[0]?.dados || {};
}

/** Grava (insere ou substitui) objetos com id numa coleção. */
export async function gravarColecao(tabela: string, objetos: { id: string }[]) {
  const agora = new Date().toISOString();
  for (let i = 0; i < objetos.length; i += 200) {
    await rest(tabela, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(objetos.slice(i, i + 200).map((o) => ({ id: o.id, dados: o, atualizado_em: agora }))),
    });
  }
}

/** Ids dos administradores (papel advogado): recebem os avisos de processos sem responsável. */
export async function administradores(): Promise<string[]> {
  const linhas: { auth_id: string }[] = await rest('perfis?select=auth_id&papel=eq.advogado');
  return linhas.map((l) => l.auth_id);
}

/** Estado do monitor (última execução de cada rotina), para a tela da Controladoria. */
export async function gravarEstado(id: string, dados: unknown) {
  await rest('monitor_estado', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id, dados, atualizado_em: new Date().toISOString() }]),
  });
}

export async function lerEstado(): Promise<Record<string, any>> {
  const linhas: { id: string; dados: any }[] = await rest('monitor_estado?select=id,dados');
  return Object.fromEntries(linhas.map((l) => [l.id, l.dados]));
}
