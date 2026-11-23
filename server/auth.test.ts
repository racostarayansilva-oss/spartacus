import { exigirAdministrador, exigirEquipe, Sessao } from './auth';
import { atender } from './rotas';

const s = (papel: Sessao['papel']): Sessao => ({ id: '1', nome: 'x', papel, token: 't' });

describe('acesso às integrações', () => {
  it('só o administrador vê o status', () => {
    expect(() => exigirAdministrador(s('advogado'))).not.toThrow();
    expect(() => exigirAdministrador(s('equipe'))).toThrow(/administrador/);
    expect(() => exigirAdministrador(s('cliente'))).toThrow(/administrador/);
    expect(() => exigirEquipe(s('equipe'))).not.toThrow();
  });
  it('com login ligado, /api/status sem token é recusado', async () => {
    process.env.VITE_SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'chave';
    const r = await atender({ metodo: 'GET', caminho: 'status', query: {}, corpo: null });
    expect(r.status).toBe(401);
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });
});
