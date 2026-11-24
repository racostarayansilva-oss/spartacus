// Cliente das rotas /api do próprio Spartacus.
import { obter, usuarioAtual } from './store';
import { tokenAtual } from './nuvem';

export async function api<T = any>(caminho: string, init: RequestInit = {}): Promise<T> {
  const usuario = usuarioAtual(obter());
  const token = await tokenAtual();
  const r = await fetch(`/api/${caminho.replace(/^\//, '')}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-ra-usuario': encodeURIComponent(usuario?.nome || ''),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  let dados: any = null;
  try {
    dados = await r.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!r.ok) throw new Error(dados?.erro || `Erro ${r.status}`);
  return dados as T;
}
