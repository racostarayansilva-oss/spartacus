import { afterEach, vi } from 'vitest';
import { resumirProcesso } from './integracoes/gemini';

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('Resumo Inteligente (Gemini)', () => {
  it('sem chave avisa que está desligado', async () => {
    await expect(resumirProcesso({ numero: '1' })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('chave AIza usa a API do Gemini e devolve texto e pontos', async () => {
    process.env.GEMINI_API_KEY = 'AIza-teste';
    const f = vi.fn(async () => resposta(200, { modelVersion: 'gemini-2.5-flash', candidates: [{ content: { parts: [{ text: JSON.stringify({ resumo: 'Processo de **X**.', pontos: ['Sem responsável.', ' '] }) }] } }] }));
    vi.stubGlobal('fetch', f);
    const r = await resumirProcesso({ numero: '1' });
    expect(r).toEqual({ texto: 'Processo de **X**.', pontos: ['Sem responsável.'], modelo: 'gemini-2.5-flash' });
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
  });

  it('chave AQ. usa o Vertex AI e explica quando o Google recusa a chave', async () => {
    process.env.GEMINI_API_KEY = 'AQ.teste';
    const f = vi.fn(async () => resposta(401, { error: { code: 401, message: 'API key not valid. Please pass a valid API key.' } }));
    vi.stubGlobal('fetch', f);
    await expect(resumirProcesso({ numero: '1' })).rejects.toThrow(/recusou a chave/);
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toMatch(/^https:\/\/aiplatform\.googleapis\.com\//);
  });
});
