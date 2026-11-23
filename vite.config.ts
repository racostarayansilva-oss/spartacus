/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, atende /api/* com as mesmas rotas da função da Vercel.
function apiLocal(): Plugin {
  return {
    name: 'ra-connect-api-local',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', async (req, res) => {
        const { atender } = await server.ssrLoadModule('/server/rotas.ts');
        const url = new URL(req.url || '/', 'http://localhost');
        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => (query[k] = v));
        let corpo: any = null;
        if (req.method === 'POST') {
          const partes: Buffer[] = [];
          for await (const p of req) partes.push(p as Buffer);
          try {
            corpo = JSON.parse(Buffer.concat(partes).toString('utf8') || 'null');
          } catch {
            corpo = null;
          }
        }
        const r = await atender({
          metodo: req.method || 'GET',
          caminho: url.pathname,
          query,
          corpo,
          usuario: String(req.headers['x-ra-usuario'] || ''),
          autorizacao: String(req.headers['authorization'] || ''),
        });
        res.statusCode = r.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(r.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Disponibiliza as variáveis do .env para as integrações no modo dev
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), apiLocal()],
    test: { globals: true, environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
  };
});
