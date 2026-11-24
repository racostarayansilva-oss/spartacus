import { afterEach, vi } from 'vitest';
import { resumirFala } from './integracoes/deepseek';

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;

afterEach(() => { vi.unstubAllGlobals(); delete process.env.DEEPSEEK_API_KEY; });

describe('Resumo de fala (Ditado)', () => {
  it('sem texto rejeita', async () => {
    process.env.DEEPSEEK_API_KEY = 'x';
    await expect(resumirFala('   ')).rejects.toThrow(/Grave algo/);
  });

  it('manda a transcrição e devolve resumo e pontos', async () => {
    process.env.DEEPSEEK_API_KEY = 'x';
    vi.stubGlobal('fetch', vi.fn(async () => resposta(200, { model: 'deepseek-chat', choices: [{ message: { content: JSON.stringify({ resumo: 'Reunião com Maria sobre aposentadoria.', pontos: ['Trazer CTPS na quinta', ''] }) } }] })));
    const r = await resumirFala('A cliente Maria disse que quer dar entrada na aposentadoria e precisa levar a CTPS na quinta.');
    expect(r.texto).toBe('Reunião com Maria sobre aposentadoria.');
    expect(r.pontos).toEqual(['Trazer CTPS na quinta']);
    expect(r.modelo).toBe('deepseek-chat');
  });
});
