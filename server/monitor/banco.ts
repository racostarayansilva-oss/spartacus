// Acesso do monitor ao Supabase com a chave SECRETA (só no servidor próprio, em SUPABASE_SECRET_KEY).
// Ela ignora as regras de acesso (RLS): nunca vai para o navegador nem para o /config.js.
// Por isso TODA leitura e gravação aqui filtra pelo escritório (escritorio_id).
import { env } from '../http.js';

const url = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '');
const chave = () => env('SUPABASE_SECRET_KEY');

export const bancoMonitorConfigurado = () => !!(url() && chave());

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  const k = chave();
  // Chave nova (sb_secret_…) vai só em apikey; a antiga (JWT service_role) também no Authorization.
  return { apikey: k, ...(k.split('.').length === 3 ? { Authorization: `Bearer ${k}` } : {}), 'Content-Type': 'application/json', ...extra };
}

export async function rest(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${url()}/rest/v1/${caminho}`, { ...init, headers: cabecalhos(init.headers as Record<string, string>), signal: AbortSignal.timeout(60_000) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} em ${caminho.split('?')[0]}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const uuid = /^[0-9a-f-]{36}$/i;
function filtro(eid: string): string {
  if (!uuid.test(eid)) throw new Error('Escritório inválido.');
  return `escritorio_id=eq.${eid}`;
}

export interface EscritorioMonitor {
  id: string; slug: string; nome: string; dominios: string[];
  whatsapp: { instancia?: string; destino?: string };
}

/** Escritórios que o monitor atende (em implantação ou ativos). */
export async function escritoriosAtivos(): Promise<EscritorioMonitor[]> {
  return (await rest('escritorios?select=id,slug,nome,dominios,whatsapp&situacao=in.(implantacao,ativo)&order=criado_em')) || [];
}

export async function escritorio(eid: string): Promise<EscritorioMonitor | null> {
  const l = await rest(`escritorios?select=id,slug,nome,dominios,whatsapp&id=eq.${eid}&situacao=in.(implantacao,ativo)`);
  return l?.[0] || null;
}

/** Todas as linhas (coluna dados) de uma coleção do escritório. */
export async function lerColecao<T>(tabela: string, eid: string): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const linhas: { dados: T }[] = await rest(`${tabela}?select=dados&${filtro(eid)}&order=id&limit=1000&offset=${de}`);
    todas.push(...linhas.map((l) => l.dados));
    if (linhas.length < 1000) return todas;
  }
}

export async function lerIds(tabela: string, eid: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let de = 0; ; de += 1000) {
    const linhas: { id: string }[] = await rest(`${tabela}?select=id&${filtro(eid)}&order=id&limit=1000&offset=${de}`);
    linhas.forEach((l) => ids.add(l.id));
    if (linhas.length < 1000) return ids;
  }
}

export async function lerConfig(eid: string): Promise<any> {
  const linhas = await rest(`config?select=dados&${filtro(eid)}&id=eq.escritorio`);
  return linhas?.[0]?.dados || {};
}

/** Grava (insere ou substitui) objetos com id numa coleção do escritório. */
export async function gravarColecao(tabela: string, eid: string, objetos: { id: string }[]) {
  filtro(eid);
  const agora = new Date().toISOString();
  for (let i = 0; i < objetos.length; i += 200) {
    await rest(`${tabela}?on_conflict=escritorio_id,id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(objetos.slice(i, i + 200).map((o) => ({ escritorio_id: eid, id: o.id, dados: o, atualizado_em: agora }))),
    });
  }
}

/** Ids dos administradores do escritório: recebem os avisos de processos sem responsável. */
export async function administradores(eid: string): Promise<string[]> {
  const linhas: { auth_id: string }[] = await rest(`perfis?select=auth_id&papel=eq.advogado&${filtro(eid)}`);
  return linhas.map((l) => l.auth_id);
}

/** Estado do monitor (última execução de cada rotina), para a tela da Controladoria. */
export async function gravarEstado(eid: string, id: string, dados: unknown) {
  filtro(eid);
  await rest('monitor_estado?on_conflict=escritorio_id,id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ escritorio_id: eid, id, dados, atualizado_em: new Date().toISOString() }]),
  });
}

export async function lerEstado(eid: string): Promise<Record<string, any>> {
  const linhas: { id: string; dados: any }[] = await rest(`monitor_estado?select=id,dados&${filtro(eid)}`);
  return Object.fromEntries(linhas.map((l) => [l.id, l.dados]));
}
