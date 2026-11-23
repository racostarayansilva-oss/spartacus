import { afterEach, vi } from 'vitest';
import { sessaoCrm } from './integracoes/crm';

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;

const configurar = () => {
  process.env.CRM_URL = 'https://crm.exemplo.com.br/';
  process.env.CRM_API_URL = 'https://api-crm.exemplo.com.br';
  process.env.CRM_SSO_TOKEN = 'segredo';
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRM_URL;
  delete process.env.CRM_API_URL;
  delete process.env.CRM_SSO_TOKEN;
});

describe('Ponte de login do CRM', () => {
  it('sem variáveis avisa que o CRM não está configurado', async () => {
    await expect(sessaoCrm('a@b.com')).rejects.toThrow(/CRM_URL/);
  });

  it('envia o segredo e o e-mail e devolve o token do CRM', async () => {
    configurar();
    const f = vi.fn(async () => resposta(200, { access_token: 'tok', expires_in: 3600 }));
    vi.stubGlobal('fetch', f);
    const r = await sessaoCrm('Fulano@Escritorio.com');
    expect(r.url).toBe('https://crm.exemplo.com.br');
    expect(r.token).toBe('tok');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api-crm.exemplo.com.br/api/v1/sso/ra-connect');
    expect((init.headers as Record<string, string>)['X-RA-Connect-Token']).toBe('segredo');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'fulano@escritorio.com' });
  });

  it('explica quando o usuário não existe no CRM', async () => {
    configurar();
    vi.stubGlobal('fetch', vi.fn(async () => resposta(404, { erro: 'usuario_nao_cadastrado_no_crm' })));
    await expect(sessaoCrm('x@y.com')).rejects.toThrow(/não está cadastrado no CRM/);
  });
});
