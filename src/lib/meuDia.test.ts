import { describe, expect, it } from 'vitest';
import { montarMeuDia } from './meuDia';
import { buscarTudo, mascararCpf } from './buscaGlobal';

const banco: any = {
  clientes: [
    { id: 'c1', nome: 'Maria das Graças Souza', cpf: '52998224725', telefone: '(11) 99111-0001', cidade: 'Santos' },
    { id: 'c2', nome: 'João Pereira', cpf: '11144477735', telefone: '' },
  ],
  processos: [
    { id: 'p1', numero: '1000123-45.2026.4.01.3900', clienteId: 'c1', assunto: 'Aposentadoria rural', responsavelId: 'u1' },
    { id: 'p2', numero: '0800001-11.2026.8.10.0001', clienteId: 'c2', assunto: 'BPC', responsavelId: 'u2' },
  ],
  compromissos: [
    { id: 'm1', titulo: 'Réplica', data: '2026-11-20', status: 'pendente', responsavelId: 'u1', processoId: 'p1' },
    { id: 'm2', titulo: 'Recurso', data: '2026-11-23', status: 'pendente', responsavelId: 'u2' },
    { id: 'm3', titulo: 'Feito', data: '2026-11-23', status: 'concluido', responsavelId: 'u1' },
    { id: 'm4', titulo: 'Longe', data: '2026-12-30', status: 'pendente', responsavelId: 'u1' },
  ],
  tarefas: [
    { id: 't1', titulo: 'Ligar para cliente', prazo: '2026-11-23', coluna: 'afazer', responsavelId: 'u2', participantes: ['u1'] },
    { id: 't2', titulo: 'Sem prazo', prazo: null, coluna: 'afazer', responsavelId: 'u1' },
    { id: 't3', titulo: 'Concluída', prazo: '2026-11-23', coluna: 'concluido', responsavelId: 'u1' },
  ],
  audiencias: [
    { id: 'a1', processoId: 'p1', data: '2026-11-25', hora: '09:00', local: 'JEF Belém' },
    { id: 'a2', processoId: 'p2', data: '2026-11-24', hora: '10:00', local: '' },
    { id: 'a3', processoId: 'p1', data: '2026-11-01', hora: '10:00', local: '' },
  ],
};

describe('meu dia', () => {
  it('separa atrasados, hoje e próximos da pessoa', () => {
    const d = montarMeuDia(banco, '2026-11-23', 'u1');
    expect(d.atrasados.map((i) => i.id)).toEqual(['m1']);
    expect(d.hoje.map((i) => i.id)).toEqual(['t1']); // participante também vê
    expect(d.proximos.map((i) => i.id)).toEqual(['a1']); // audiência de p2 é de outra pessoa
    expect(d.atrasados[0].detalhe).toBe('Maria das Graças Souza');
  });
  it('equipe inteira', () => {
    const d = montarMeuDia(banco, '2026-11-23', null);
    expect(d.hoje.map((i) => i.id).sort()).toEqual(['m2', 't1']);
    expect(d.proximos.map((i) => i.id)).toEqual(['a2', 'a1']);
  });
});

describe('busca global', () => {
  it('acha por nome, CPF e número do processo', () => {
    expect(buscarTudo(banco, 'maria')[0]).toMatchObject({ tipo: 'cliente', id: 'c1' });
    expect(buscarTudo(banco, '111.444')[0]).toMatchObject({ tipo: 'cliente', id: 'c2' });
    expect(buscarTudo(banco, '1000123-45')[0]).toMatchObject({ tipo: 'processo', id: 'p1', rota: '/processos/p1' });
    expect(buscarTudo(banco, 'a')).toEqual([]);
  });
  it('mascara o CPF', () => {
    expect(mascararCpf('52998224725')).toBe('529.***.***-25');
  });
});
