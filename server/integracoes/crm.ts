// Ponte de login com o Evo CRM: troca a sessão do RA Connect por um token do CRM.
// Variáveis (Vercel): CRM_URL, CRM_API_URL, CRM_SSO_TOKEN (= RA_CONNECT_SSO_TOKEN do servidor do CRM).

import { ErroApi, env } from '../http.js';

export function crmConfigurado(): boolean {
  return !!(env('CRM_URL') && env('CRM_API_URL') && env('CRM_SSO_TOKEN'));
}

export async function sessaoCrm(email: string | undefined): Promise<{ url: string; token: string; expiraEm: number }> {
  if (!crmConfigurado()) throw new ErroApi(503, 'CRM ainda não configurado: cadastre CRM_URL, CRM_API_URL e CRM_SSO_TOKEN na Vercel.');
  if (!email) throw new ErroApi(400, 'Sua conta não tem e-mail para entrar no CRM.');

  let r: Response;
  try {
    r = await fetch(`${env('CRM_API_URL').replace(/\/$/, '')}/api/v1/sso/ra-connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RA-Connect-Token': env('CRM_SSO_TOKEN') },
      body: JSON.stringify({ email: email.toLowerCase() }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ErroApi(504, 'O servidor do CRM não respondeu. Ele pode estar reiniciando; tente de novo em instantes.');
  }
  const corpo: any = await r.json().catch(() => null);
  if (r.status === 404) throw new ErroApi(403, `O e-mail ${email} não está cadastrado no CRM. Peça ao administrador para criar seu usuário lá.`);
  if (r.status === 401) throw new ErroApi(502, 'CRM_SSO_TOKEN da Vercel não confere com o do servidor do CRM.');
  if (!r.ok || !corpo?.access_token) throw new ErroApi(502, `CRM respondeu ${r.status}.`);

  return {
    url: env('CRM_URL').replace(/\/$/, ''),
    token: corpo.access_token,
    expiraEm: Date.now() + (Number(corpo.expires_in) || 28_800) * 1000,
  };
}
