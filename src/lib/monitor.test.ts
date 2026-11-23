import { aplicarComunicacoes, aplicarDataJud, destinatarios, notificacaoDoAviso, RELEVANTE } from './monitor';
import type { Cliente, Processo } from '../store';

let n = 0;
const novoId = () => `id${++n}`;

const processo = (x: Partial<Processo> = {}): Processo => ({
  id: 'p1', numero: '1055676-74.2026.4.01.3900', tipo: 'JEF', clienteId: 'c1', assunto: 'Salário-maternidade', responsavelId: 'u-ana',
  valor: 0, regiao: '', etapas: [], grupoFamiliar: [], ...x,
});
const clientes: Cliente[] = [{ id: 'c1', nome: 'Maria do Socorro', cpf: '', telefone: '', origem: 'nao_informada', criadoEm: '2026-01-01' }];
const comunicacao = (id: string, processoNumero: string, texto = 'Intimação da sentença. Prazo de 10 dias.') => ({
  id, disponibilizacao: '2026-11-17', tribunal: 'TRF1', processo: processoNumero, orgao: '8ª Vara', tipo: 'Intimação', classe: 'PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL',
  texto, partes: [{ nome: 'JOANA DA SILVA', polo: 'A' }, { nome: 'INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS', polo: 'P' }], advogados: [{ nome: 'ROMULO', oab: 'MA 14427' }],
});

describe('monitor: DJEN', () => {
  it('intimação nova vira andamento e aviso; processo desconhecido é cadastrado; repetida é ignorada', () => {
    const r = aplicarComunicacoes(
      { processos: [processo()], clientes, intimacoesIds: new Set(['djen-velha']) },
      [comunicacao('a1', '10556767420264013900'), comunicacao('a1', '10556767420264013900'), comunicacao('velha', '10556767420264013900'), comunicacao('b2', '1004752-38.2026.4.01.3907')],
      novoId,
    );
    expect(r.intimacoes.map((i) => i.id)).toEqual(['djen-a1', 'djen-b2']);
    expect(r.intimacoes[0].dias).toBe(10);
    expect(r.processosAlterados).toHaveLength(1);
    expect(r.processosAlterados[0].movimentosOficiais?.[0].nome).toBe('Intimação no DJEN — TRF1');
    expect(r.processosNovos.map((p) => p.numero)).toEqual(['1004752-38.2026.4.01.3907']);
    expect(r.clientesNovos[0].nome).toBe('Joana da Silva');
    expect(r.avisos.map((a) => a.titulo)).toEqual(['Intimação: Maria do Socorro', 'Processo novo pelo DJEN: Joana da Silva']);
  });
});

describe('monitor: DataJud', () => {
  const capa = (movimentos: { data: string; nome: string }[]) => ({ movimentos, classe: 'JEF', assuntos: ['Salário-Maternidade'], tribunal: 'TRF1', grau: 'JE' });
  const djen = { data: '2026-11-17', nome: 'Intimação no DJEN — TRF1', complemento: 'x' };

  it('primeira consulta carrega o histórico sem avisar', () => {
    const r = aplicarDataJud(processo({ movimentosOficiais: [djen] }), capa([{ data: '2026-09-25T10:00:00', nome: 'Homologação' }]), '2026-11-18T10:00:00Z');
    expect(r.novos).toHaveLength(0);
    expect(r.mudou).toBe(true);
    expect(r.processo.movimentosOficiais?.map((m) => m.nome)).toEqual(['Intimação no DJEN — TRF1', 'Homologação']);
  });

  it('depois, só avisa o que for novo; sem mudança não grava', () => {
    const base = aplicarDataJud(processo(), capa([{ data: '2026-09-25T10:00:00', nome: 'Homologação' }]), '2026-11-18T10:00:00Z').processo;
    const igual = aplicarDataJud(base, capa([{ data: '2026-09-25T10:00:00', nome: 'Homologação' }]), '2026-11-18T16:00:00Z');
    expect(igual.mudou).toBe(false);
    const nova = aplicarDataJud(base, capa([{ data: '2026-11-18T09:00:00', nome: 'Expedição de RPV' }, { data: '2026-09-25T10:00:00', nome: 'Homologação' }]), '2026-11-18T16:00:00Z');
    expect(nova.novos.map((m) => m.nome)).toEqual(['Expedição de RPV']);
    expect(RELEVANTE.test('Expedição de RPV')).toBe(true);
    expect(RELEVANTE.test('Juntada de Petição')).toBe(false);
  });
});

describe('monitor: quem recebe', () => {
  it('responsável; sem responsável, os administradores', () => {
    expect(destinatarios(processo(), ['u-r'])).toEqual(['u-ana']);
    expect(destinatarios(processo({ responsavelId: '' }), ['u-r', 'u-s'])).toEqual(['u-r', 'u-s']);
    const notif = notificacaoDoAviso({ processoId: 'p1', titulo: 'Andamento: Maria', texto: 'x', relevante: true }, 'u-ana', novoId, '2026-11-18T10:00:00Z');
    expect(notif).toMatchObject({ paraId: 'u-ana', deId: 'sistema', tipo: 'aviso', link: '/processos/p1' });
  });
});
