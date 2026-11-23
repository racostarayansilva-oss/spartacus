// Função única da Vercel. O vercel.json reescreve /api/* para cá (o plano gratuito limita o número de funções).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { atender } from '../server/rotas.js';

type Req = IncomingMessage & { query?: Record<string, string | string[]>; body?: any };

export default async function handler(req: Req, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  const caminho = query.path ?? url.pathname.replace(/^\/api\/?/, '');
  delete query.path;

  const r = await atender({
    metodo: req.method || 'GET',
    caminho,
    query,
    corpo: req.body,
    usuario: String(req.headers['x-ra-usuario'] || ''),
    autorizacao: String(req.headers['authorization'] || ''),
  });
  res.statusCode = r.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(r.body));
}
