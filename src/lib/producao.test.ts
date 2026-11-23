import type { Banco } from '../store';
import { csvDoMes, diasUteis, formatarMinutos, intervaloDoMes, itensDoPeriodo, mesVizinho, nomeDoMes, porTipo, ranking, resumoAutomatico, sequencia } from './producao';

const banco = (): Banco => ({
  usuarios: [
    { id: 'a', nome: 'Ana', papel: 'equipe' },
    { id: 'b', nome: 'Bruno', papel: 'equipe' },
    { id: 'c', nome: 'Cliente', papel: 'cliente' },
  ],
  atividades: [
    { id: 'x1', data: '2026-11-10', usuarioId: 'a', tipo: 'peticao', titulo: 'Inicial BPC', status: 'concluida', minutos: 90, criadaEm: '' },
    { id: 'x2', data: '2026-11-10', usuarioId: 'a', tipo: 'ligacao', titulo: 'Ligar Maria', status: 'andamento', minutos: 10, criadaEm: '' },
    { id: 'x3', data: '2026-10-31', usuarioId: 'b', tipo: 'protocolo', titulo: 'Fora do mês', status: 'concluida', criadaEm: '' },
  ],
  tarefas: [
    { id: 't1', titulo: 'Réplica', responsavelId: 'b', pontos: 5, coluna: 'concluido', concluidaEm: '2026-11-10' },
    { id: 't2', titulo: 'Aberta', responsavelId: 'b', pontos: 8, coluna: 'fazendo' },
  ],
  registros: [{ id: 'r1', data: '2026-11-11', tipo: 'recurso', usuarioId: 'a' }],
  relatoriosDiarios: [
    { id: 'a:2026-11-09', data: '2026-11-09', usuarioId: 'a', entregueEm: '', resumo: '', pontos: 0, itens: 0 },
    { id: 'a:2026-11-10', data: '2026-11-10', usuarioId: 'a', entregueEm: '', resumo: '', pontos: 0, itens: 0 },
  ],
} as unknown as Banco);

describe('Produção', () => {
  it('junta atividades, tarefas concluídas e movimentações; só pontua o que foi concluído', () => {
    const itens = itensDoPeriodo(banco(), '2026-11-01', '2026-11-30');
    expect(itens.map((i) => i.id).sort()).toEqual(['registro:r1', 'tarefa:t1', 'x1', 'x2']);
    expect(itens.find((i) => i.id === 'x2')!.pontos).toBe(0);
    expect(itens.find((i) => i.id === 'x1')!.pontos).toBe(3);
  });

  it('ranking ordena por pontos, ignora clientes e calcula assiduidade em dias úteis', () => {
    const r = ranking(banco(), '2026-11-01', '2026-11-30', '2026-11-11');
    expect(r.map((l) => l.usuarioId)).toEqual(['a', 'b']);
    expect(r[0].pontos).toBe(6); // petição 3 + recurso 3
    expect(r[1].pontos).toBe(5);
    expect(r[0].diasEsperados).toBe(8); // 2 a 6 e 9 a 11 de novembro de 2026
    expect(r[0].relatorios).toBe(2);
  });

  it('dias úteis e meses', () => {
    expect(diasUteis('2026-11-06', '2026-11-09')).toEqual(['2026-11-06', '2026-11-09']);
    expect(intervaloDoMes('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
    expect(mesVizinho('2026-01', -1)).toBe('2025-12');
  });

  it('sequência de relatórios pula fim de semana e não quebra no dia ainda aberto', () => {
    const b = banco();
    expect(sequencia(b.relatoriosDiarios, 'a', '2026-11-11')).toBe(2);
    expect(sequencia(b.relatoriosDiarios, 'b', '2026-11-11')).toBe(0);
  });

  it('resumo automático e formatos', () => {
    const itens = itensDoPeriodo(banco(), '2026-11-10', '2026-11-10', 'a');
    const txt = resumoAutomatico(itens);
    expect(txt).toContain('1 entrega concluída (3 pts) · 1h40 de trabalho registrado.');
    expect(nomeDoMes('2026-11')).toBe('Novembro de 2026');
    const muitos = Array.from({ length: 9 }, (_, n) => ({ ...itens[0], tipo: `T${n}`, pontos: 9 - n }));
    const tipos = porTipo(muitos);
    expect(tipos).toHaveLength(7);
    expect(tipos[6]).toEqual({ tipo: 'Outros', quantidade: 3, pontos: 6 });
    expect(txt).toContain('Em andamento:\n• Ligar Maria');
    expect(formatarMinutos(45)).toBe('45min');
    expect(formatarMinutos(120)).toBe('2h');
    expect(csvDoMes(ranking(banco(), '2026-11-01', '2026-11-30', '2026-11-11'))).toContain('1;Ana;6;');
  });
});
