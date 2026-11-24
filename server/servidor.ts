// Servidor próprio (VPS): entrega o site (pasta dist) e atende /api/* com as mesmas rotas da Vercel.
// Uso: node servidor.mjs   (porta em PORT, padrão 3000). As variáveis vêm do ambiente (ver infra/spartacus/spartacus.env.example).
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { atender } from './rotas.js';
import { env } from './http.js';
import { iniciarMonitor } from './monitor/agendador.js';
import { atenderMonitor } from './monitor/rotas.js';

const PASTA = join(process.cwd(), 'dist');
const PORTA = Number(env('PORT')) || 3000;
const LIMITE_CORPO = 6 * 1024 * 1024; // e-mails dos clientes chegam em base64 (até ~4 MB)

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const SEGURANCA: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
};

/** Configuração pública que o navegador precisa (a chave anon do Supabase é pública por natureza). */
/** Chave que nunca pode ir para o navegador: sb_secret_… ou JWT com role service_role. */
export function chaveSecreta(chave: string): boolean {
  if (chave.startsWith('sb_secret_')) return true;
  const partes = chave.split('.');
  if (partes.length !== 3) return false;
  try { return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role === 'service_role'; } catch { return false; }
}

function configJs(): string {
  let chave = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (chave && chaveSecreta(chave)) {
    console.error('SUPABASE_ANON_KEY contém a chave SECRETA do Supabase. Ela não foi publicada. Use a publishable (sb_publishable_…) ou a anon.');
    chave = '';
  }
  const cfg = { supabaseUrl: env('SUPABASE_URL') || env('VITE_SUPABASE_URL'), supabaseAnonKey: chave };
  return `window.RA_CONFIG = ${JSON.stringify(cfg)};\n`;
}

function lerCorpo(req: IncomingMessage): Promise<any> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (p: Buffer) => {
      total += p.length;
      if (total > LIMITE_CORPO) { falha(Object.assign(new Error('Corpo grande demais'), { status: 413 })); req.destroy(); return; }
      partes.push(p);
    });
    req.on('end', () => {
      const texto = Buffer.concat(partes).toString('utf8');
      if (!texto) return ok(undefined);
      const tipo = String(req.headers['content-type'] || '');
      if (tipo.includes('json')) {
        try { ok(JSON.parse(texto)); } catch { falha(Object.assign(new Error('JSON inválido'), { status: 400 })); }
      } else ok(texto);
    });
    req.on('error', falha);
  });
}

function json(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEGURANCA });
  res.end(JSON.stringify(corpo));
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  let corpo: any;
  try {
    corpo = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await lerCorpo(req);
  } catch (e: any) {
    return json(res, e.status || 400, { erro: e.message });
  }
  const caminho = url.pathname.replace(/^\/api\/?/, '');
  const monitor = await atenderMonitor(req.method || 'GET', caminho, String(req.headers['authorization'] || ''), corpo);
  if (monitor) return json(res, monitor.status, monitor.body);
  const r = await atender({
    metodo: req.method || 'GET',
    caminho,
    query,
    corpo,
    usuario: String(req.headers['x-ra-usuario'] || ''),
    autorizacao: String(req.headers['authorization'] || ''),
  });
  json(res, r.status, r.body);
}

const indexHtml = () => readFileSync(join(PASTA, 'index.html'));

function estatico(req: IncomingMessage, res: ServerResponse, url: URL) {
  let caminho: string;
  try { caminho = decodeURIComponent(url.pathname); } catch { caminho = '/'; }
  const arquivo = normalize(join(PASTA, caminho));
  const dentro = arquivo === PASTA || arquivo.startsWith(PASTA + sep);
  if (dentro && caminho !== '/' && existsSync(arquivo) && statSync(arquivo).isFile()) {
    const ext = extname(arquivo).toLowerCase();
    // Arquivos com hash no nome (pasta assets) nunca mudam: cache de 1 ano
    const cache = caminho.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300';
    res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SEGURANCA });
    if (req.method === 'HEAD') return res.end();
    createReadStream(arquivo).pipe(res);
    return;
  }
  // Arquivo que não existe dentro de /assets: 404 de verdade (evita devolver HTML no lugar de JS)
  if (caminho.startsWith('/assets/') || extname(caminho)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SEGURANCA });
    return res.end('Não encontrado');
  }
  // Rotas do app (React Router): sempre o index.html, sem cache
  res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-cache', ...SEGURANCA });
  res.end(req.method === 'HEAD' ? undefined : indexHtml());
}

/**
 * Caddy (on-demand TLS) pergunta aqui antes de emitir certificado: libera os subdomínios da plataforma
 * (slug.DOMINIO_PLATAFORMA) e os domínios próprios cadastrados para um escritório. Só a rede interna chama.
 */
export async function dominioPermitido(dominio: string): Promise<boolean> {
  const d = dominio.trim().toLowerCase();
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return false;
  const base = (env('DOMINIO_PLATAFORMA') || '').toLowerCase();
  if (base && (d === base || d === `www.${base}` || d === `app.${base}`)) return true;
  if (base && d.endsWith(`.${base}`) && /^[a-z0-9-]+$/.test(d.slice(0, -base.length - 1))) {
    // Subdomínio: só se existir escritório com esse slug
    const r = await fetch(`${(env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '')}/rest/v1/rpc/marca_publica`, {
      method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_host: d }), signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    return !!r?.ok && (await r.json().catch(() => null)) != null;
  }
  const r = await fetch(`${(env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '')}/rest/v1/rpc/dominio_permitido`, {
    method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_host: d }), signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!r?.ok && (await r.json().catch(() => false)) === true;
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/saude') return json(res, 200, { ok: true });
    if (url.pathname === '/interno/dominio-permitido') {
      const ok = await dominioPermitido(url.searchParams.get('domain') || '');
      res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/plain' });
      return res.end(ok ? 'ok' : 'nao');
    }
    if (url.pathname === '/config.js') {
      res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-cache', ...SEGURANCA });
      return res.end(configJs());
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { erro: 'Método não permitido' });
    estatico(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { erro: 'Erro interno' });
    else res.end();
  }
});

servidor.requestTimeout = 120_000;
servidor.listen(PORTA, () => {
  console.log(`Spartacus no ar na porta ${PORTA} (site em ${PASTA})`);
  iniciarMonitor();
});

const encerrar = () => servidor.close(() => process.exit(0));
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
