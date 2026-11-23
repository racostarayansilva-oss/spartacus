import type { Banco, Processo } from '../store';
import { montarDadosResumo, partesNegrito, pontosDeAtencao, situacaoDoProcesso } from './resumoProcesso';

const H = '2026-11-09';
const proc = (x: Partial<Processo> = {}): Processo => ({
  id: 'p1', numero: '1061569-64.2026.4.01.3700', tipo: 'JEF', clienteId: 'c1', assunto: 'Procedimento do Juizado Especial Cível — contra Instituto Nacional do Seguro Social',
  responsavelId: '', valor: 24315, regiao: '8ª Vara Federal de JEF da SJMA', etapas: [{ etapa: 'Entrada', data: '2026-07-16' }], grupoFamiliar: [],
  movimentosOficiais: [{ data: '2026-11-01', nome: 'Intimação no DJEN — TRF1', complemento: 'POLO ATIVO: MARIA DA SILVA CPF 123.456.789-00' }],
  dadosJudiciais: { classe: 'Procedimento do Juizado Especial Cível', assuntos: ['Pensão por Morte (Art. 74/9)', 'Rural'], orgao: 'Seção Judiciária do Maranhão', ajuizamento: '2026-07-16', atualizadoEm: '2026-11-09T10:00:00Z' },
  ...x,
});
const banco = (p: Processo): Banco => ({
  processos: [p],
  clientes: [{ id: 'c1', nome: 'Maria da Silva', cpf: '12345678900', telefone: '(98) 99999-0000' }],
  compromissos: [{ id: 'm1', processoId: 'p1', status: 'pendente', data: '2026-11-11', titulo: 'Réplica' }],
  audiencias: [{ id: 'a1', processoId: 'p1', data: '2026-11-12', hora: '09:00', clienteContatado: false, testemunhasConfirmadas: true }],
  tarefas: [{ id: 't1', processoId: 'p1', coluna: 'afazer', prazo: '2026-11-01' }],
  intimacoes: [{ id: 'i1', status: 'nova', processoNumero: '10615696420264013700' }],
} as unknown as Banco);

describe('pontos de atenção', () => {
  it('saem das regras do sistema', () => {
    const pts = pontosDeAtencao(banco(proc()), proc(), H);
    expect(pts).toContain('Processo sem responsável definido.');
    expect(pts).toContain('Prazo em 11/11/2026: Réplica.');
    expect(pts.find((x) => x.startsWith('Audiência em 12/11/2026 às 09:00'))).toMatch(/sem contato/);
    expect(pts).toContain('1 tarefa(s) atrasada(s).');
    expect(pts).toContain('1 intimação(ões) sem tratar na Controladoria.');
    expect(pts).not.toContain('Valor da causa não informado.');
    expect(pontosDeAtencao(banco(proc({ valor: 0 })), proc({ valor: 0 }), H)).toContain('Valor da causa não informado.');
  });
});

describe('situação do processo', () => {
  it('ativo, arquivado ou suspenso pelas movimentações recentes', () => {
    expect(situacaoDoProcesso(proc())).toBe('ativo');
    expect(situacaoDoProcesso(proc({ movimentosOficiais: [{ data: '2026-11-01', nome: 'Arquivamento definitivo' }] }))).toBe('arquivado');
    expect(situacaoDoProcesso(proc({ movimentosOficiais: [{ data: '2026-11-01', nome: 'Suspensão ou Sobrestamento' }] }))).toBe('suspenso');
  });
});

describe('dados enviados para a IA', () => {
  it('não levam nome, CPF nem telefone de ninguém', () => {
    const d = montarDadosResumo(banco(proc()), proc(), H);
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/Maria/i);
    expect(json).not.toMatch(/123\.456|12345678900|99999/);
    expect(json).not.toMatch(/Instituto Nacional/); // parte contrária fica de fora
    expect(d.valorDaCausa?.replace(/\s/g, ' ')).toBe('R$ 24.315,00');
    expect(d).toMatchObject({ numero: '1061569-64.2026.4.01.3700', fase: 'Entrada', orgao: 'Seção Judiciária do Maranhão', desde: '16/07/2026' });
    expect(d.assuntos).toEqual(['Pensão por Morte (Art. 74/9)', 'Rural']);
    expect(d.ultimasMovimentacoes[0].movimento).toBe('Intimação no DJEN — TRF1');
  });
});

describe('negrito do texto da IA', () => {
  it('separa os trechos em **negrito**', () => {
    expect(partesNegrito('Processo de **PENSÃO** com número **123**.')).toEqual([
      { t: 'Processo de ', negrito: false }, { t: 'PENSÃO', negrito: true }, { t: ' com número ', negrito: false }, { t: '123', negrito: true }, { t: '.', negrito: false },
    ]);
  });
});
