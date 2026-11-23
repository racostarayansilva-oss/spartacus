// Utilitários HTTP compartilhados pelas integrações.
import dotenv from 'dotenv';
dotenv.config(); // Carrega .env no ambiente local (Vercel não precisa)

export class ErroApi extends Error {
  constructor(public status: number, message: string, public detalhe?: unknown) {
    super(message);
  }
}

export interface Resposta {
  status: number;
  body: unknown;
}

export const ok = (body: unknown): Resposta => ({ status: 200, body });

export function env(nome: string): string {
  return (process.env[nome] || '').trim();
}

/** Explica em português por que a conexão com o órgão falhou. */
function motivoFalha(e: any, host: string): { status: number; msg: string; repetir: boolean } {
  const codigo = String(e?.cause?.code || e?.code || '');
  if (/CONNECT_TIMEOUT|ETIMEDOUT/.test(codigo)) return { status: 504, msg: `O servidor de ${host} não respondeu (sem conexão). O serviço do órgão pode estar fora do ar.`, repetir: false };
  if (/ENOTFOUND|EAI_AGAIN/.test(codigo)) return { status: 502, msg: `Endereço ${host} não encontrado.`, repetir: true };
  if (/ECONNRESET|ECONNREFUSED|UND_ERR_SOCKET|EPIPE|ERR_SSL|EPROTO/.test(codigo)) return { status: 502, msg: `${host} recusou ou derrubou a conexão (${codigo}).`, repetir: true };
  return { status: 502, msg: `Falha ao consultar ${host}: ${e?.cause?.message || e?.message || e}${codigo ? ` (${codigo})` : ''}`, repetir: true };
}

export async function buscarJson<T = any>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  tentativa = 1,
): Promise<T> {
  const { timeoutMs = 20_000, ...resto } = init;
  const host = new URL(url).host;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...resto,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'RA-Connect/0.1', ...(resto.headers || {}) },
    });
    const texto = await r.text();
    let dados: any;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = texto;
    }
    if (r.status === 429) throw new ErroApi(429, 'Limite de consultas da fonte atingido. Aguarde 1 minuto.');
    if (r.status === 503) throw new ErroApi(503, `O serviço de ${host} está fora do ar no momento (503). Tente mais tarde.`);
    if (!r.ok) throw new ErroApi(r.status === 404 ? 404 : 502, `${host} respondeu ${r.status}`, typeof dados === 'string' ? dados.slice(0, 500) : dados);
    return dados as T;
  } catch (e: any) {
    if (e instanceof ErroApi) throw e;
    if (e?.name === 'AbortError') throw new ErroApi(504, `${host} demorou mais de ${Math.round(timeoutMs / 1000)} s para responder.`);
    const f = motivoFalha(e, host);
    // Uma nova tentativa para quedas momentâneas de conexão
    if (f.repetir && tentativa === 1) {
      clearTimeout(timer);
      await esperar(800);
      return buscarJson<T>(url, init, 2);
    }
    throw new ErroApi(f.status, f.msg);
  } finally {
    clearTimeout(timer);
  }
}

export function exigir(valor: unknown, mensagem: string): asserts valor {
  if (valor === undefined || valor === null || valor === '') throw new ErroApi(400, mensagem);
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
