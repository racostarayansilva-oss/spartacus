import type { Tarefa } from '../store';
import {
  colunaDoQuadro, dataCurta, desempenho, envolvidos, filtrarTarefas, moverNoQuadro, ordenarParaQuadro, resumoTarefas, rotuloPrazo, tarefaDaIntimacao,
} from './tarefas';

const H = '2026-11-09';
const AGORA = '2026-11-09T14:30:00.000Z';
const t = (x: Partial<Tarefa>): Tarefa => ({ id: Math.random().toString(36), titulo: 'T', responsavelId: 'u1', pontos: 2, coluna: 'afazer', ...x });

describe('colunas do quadro', () => {
  it('cada tarefa cai em uma coluna só', () => {
    expect(colunaDoQuadro(t({ prazo: null }), H)).toBe('todas');
    expect(colunaDoQuadro(t({ prazo: '2026-12-01' }), H)).toBe('todas');
    expect(colunaDoQuadro(t({ prazo: H }), H)).toBe('hoje');
    expect(colunaDoQuadro(t({ prazo: '2026-11-02' }), H)).toBe('hoje'); // atrasada
    expect(colunaDoQuadro(t({ prazo: '2026-11-10' }), H)).toBe('proximos');
    expect(colunaDoQuadro(t({ prazo: '2026-11-16' }), H)).toBe('proximos');
    expect(colunaDoQuadro(t({ prazo: '2026-11-17' }), H)).toBe('todas');
    expect(colunaDoQuadro(t({ coluna: 'fazendo', prazo: H }), H)).toBe('fazendo');
    expect(colunaDoQuadro(t({ coluna: 'revisao' }), H)).toBe('fazendo');
    expect(colunaDoQuadro(t({ coluna: 'concluido', concluidaEm: H }), H)).toBe('concluidas');
    expect(colunaDoQuadro(t({ coluna: 'concluido', concluidaEm: '2026-11-08' }), H)).toBeNull();
  });
});

describe('arrastar entre colunas', () => {
  it('Hoje põe prazo hoje; mantém se já estava atrasada', () => {
    const a = t({ prazo: '2026-12-20' });
    moverNoQuadro(a, 'hoje', H, 'u1', AGORA);
    expect(a.prazo).toBe(H);
    const atrasada = t({ prazo: '2026-11-01' });
    moverNoQuadro(atrasada, 'hoje', H, 'u1', AGORA);
    expect(atrasada.prazo).toBe('2026-11-01');
    expect(atrasada.historico).toBeUndefined(); // nada mudou
  });

  it('Próximos dias põe amanhã; Todas tira o prazo próximo', () => {
    const a = t({ prazo: H });
    moverNoQuadro(a, 'proximos', H, 'u1', AGORA);
    expect(a.prazo).toBe('2026-11-10');
    moverNoQuadro(a, 'todas', H, 'u1', AGORA);
    expect(a.prazo).toBeNull();
    expect(colunaDoQuadro(a, H)).toBe('todas');
    const longe = t({ prazo: '2027-01-30' });
    moverNoQuadro(longe, 'todas', H, 'u1', AGORA);
    expect(longe.prazo).toBe('2027-01-30');
  });

  it('Fazendo e Concluídas mudam a situação e registram no histórico', () => {
    const a = t({ prazo: H });
    moverNoQuadro(a, 'fazendo', H, 'u1', AGORA);
    expect(a.coluna).toBe('fazendo');
    moverNoQuadro(a, 'concluidas', H, 'u2', AGORA);
    expect(a.coluna).toBe('concluido');
    expect(a.concluidaEm).toBe(H);
    moverNoQuadro(a, 'hoje', H, 'u1', AGORA);
    expect(a.coluna).toBe('afazer');
    expect(a.concluidaEm).toBeNull();
    expect(a.historico!.map((x) => x.texto)).toEqual(['Mudou para Fazendo', 'Concluiu a tarefa', 'Reabriu a tarefa (A fazer)']);
    expect(a.historico![1].usuarioId).toBe('u2');
  });

  it('revisão continua em revisão ao soltar em Fazendo', () => {
    const a = t({ coluna: 'revisao' });
    moverNoQuadro(a, 'fazendo', H, 'u1', AGORA);
    expect(a.coluna).toBe('revisao');
  });
});

describe('datas', () => {
  it('rótulos do cartão', () => {
    expect(rotuloPrazo(H, null, H)).toBe('Hoje');
    expect(rotuloPrazo(H, '10:00', H)).toBe('Hoje 10:00');
    expect(rotuloPrazo('2026-11-10', null, H)).toBe('Amanhã');
    expect(rotuloPrazo('2026-11-08', null, H)).toBe('Ontem');
    expect(rotuloPrazo('2026-11-05', null, H)).toBe('Há 4 dias');
    expect(rotuloPrazo('2026-08-15', null, H)).toBe('15 ago 2026');
    expect(rotuloPrazo('2026-08-23', '10:00', H)).toBe('23 ago 2026 10:00');
    expect(dataCurta('2026-03-01')).toBe('1 mar 2026');
  });
});

describe('resumo, filtro e desempenho', () => {
  const lista = [
    t({ id: 'a', responsavelId: 'u1', coluna: 'concluido', concluidaEm: '2026-11-03', prazo: '2026-11-05', pontos: 5 }),
    t({ id: 'b', responsavelId: 'u1', coluna: 'concluido', concluidaEm: '2026-11-08', prazo: '2026-11-06', pontos: 3 }),
    t({ id: 'c', responsavelId: 'u2', coluna: 'concluido', concluidaEm: '2026-10-30', pontos: 8 }), // mês passado
    t({ id: 'd', responsavelId: 'u2', participantes: ['u1'], prazo: '2026-11-01', titulo: 'Réplica', descricao: 'contestação do banco' }),
    t({ id: 'e', responsavelId: 'u2', coluna: 'fazendo', prazo: H, etiquetas: ['urg'] }),
  ];

  it('resumo do topo conta só o mês atual', () => {
    expect(resumoTarefas(lista, H)).toEqual({ finalizadas: 2, pendentes: 2, pontos: 8, atrasadas: 1, hoje: 1, fazendo: 1 });
  });

  it('filtro por pessoa inclui quem participa', () => {
    expect(envolvidos(lista[3])).toEqual(['u2', 'u1']);
    expect(filtrarTarefas(lista, { pessoa: 'eu', usuarioAtualId: 'u1' }).map((x) => x.id)).toEqual(['a', 'b', 'd']);
    expect(filtrarTarefas(lista, { busca: 'CONTESTACAO' }).map((x) => x.id)).toEqual(['d']);
    expect(filtrarTarefas(lista, { etiqueta: 'urg' }).map((x) => x.id)).toEqual(['e']);
    expect(filtrarTarefas(lista, { busca: 'maria' }, (x) => (x.id === 'e' ? 'Maria das Graças' : '')).map((x) => x.id)).toEqual(['e']);
  });

  it('placar: pontos do responsável principal e % no prazo', () => {
    const [primeiro, segundo] = desempenho(lista, [{ id: 'u1', nome: 'Ana' }, { id: 'u2', nome: 'Bruno' }], '2026-11-01', H);
    expect(primeiro).toMatchObject({ u: { id: 'u1' }, pontos: 8, concluidas: 2, noPrazo: 50, abertas: 0 });
    expect(segundo).toMatchObject({ u: { id: 'u2' }, pontos: 0, concluidas: 0, noPrazo: null, abertas: 2, atrasadas: 1 });
  });

  it('ordem na coluna: prazo e hora, depois sem prazo', () => {
    const ord = [t({ id: 'x' }), t({ id: 'y', prazo: H, hora: '15:00' }), t({ id: 'z', prazo: H, hora: '09:00' }), t({ id: 'w', prazo: '2026-11-01' })].sort(ordenarParaQuadro);
    expect(ord.map((x) => x.id)).toEqual(['w', 'z', 'y', 'x']);
  });
});

describe('tarefa a partir de intimação', () => {
  it('leva prazo, responsável, processo e etiqueta de prazo', () => {
    const x = tarefaDaIntimacao(
      { id: 'i1', processoNumero: '1001234-56.2025.4.01.3900', tribunal: 'TRF1', texto: 'Intimação para apresentar rol de testemunhas.' },
      { id: 't1', dias: 5, fatal: '2026-11-17', responsavelId: 'u2', processoId: 'p1', nomeCliente: 'Maria das Graças', etiquetaPrazo: 'ett-prazo', usuarioId: 'u1', agora: AGORA },
    );
    expect(x).toMatchObject({ titulo: 'Cumprir prazo de 5 dias — Maria das Graças', prazo: '2026-11-17', responsavelId: 'u2', processoId: 'p1', etiquetas: ['ett-prazo'], origem: 'intimacao', intimacaoId: 'i1' });
    expect(x.historico).toHaveLength(1);
  });
});
