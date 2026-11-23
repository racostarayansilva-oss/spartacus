import type { Processo } from '../store';
import { aplicarSugestoes, eventoNoTexto, faseComSugestoes, ignorarSugestoes, sugerirEtapas, textosDoProcesso } from './fases';
import { removerEtapa } from './processos';

// Começos de comunicações reais do DJEN (nomes trocados)
const SENTENCA_TIPO_C = 'PODER JUDICIÁRIO JUSTIÇA FEDERAL Seção Judiciária do Estado do Pará 11ª Vara Federal de Juizado Especial Cível da SJPA PROCESSO Nº 1014166-52.2024.4.01.3900 AUTOR: FULANA DE TAL REU: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS SENTENÇA - TIPO C SENTENÇA 1. RELATÓRIO Dispensado o relatório';
const DESPACHO_CITADO = 'PODER JUDICIÁRIO JUSTIÇA FEDERAL Seção Judiciária do Pará 12ª Vara Federal de Juizado Especial Cível da SJPA PROCESSO: 1053687-33.2026.4.01.3900 CLASSE: PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL (436) POLO ATIVO: FULANO REPRESENTANTES POLO ATIVO: ROMULO ALVES COSTA - MA14427 POLO PASSIVO: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS DESPACHO Considerando que o INSS, devidamente citado,';
const TURMA_RECURSAL = 'Turmas Recursais dos Juizados Especiais Federais da SJAP e da SJPA Secretaria da 2ª Turma Recursal da SJAP e da SJPA INTIMAÇÃO VIA DIÁRIO ELETRÔNICO PROCESSO: 1009628-57.2026.4.01.3900 CLASSE: RECURSO INOMINADO CÍVEL (460) POLO ATIVO: FULANA';
const SO_CABECALHO = 'Seção Judiciária do Pará 8ª Vara Federal de Juizado Especial Cível da SJPA INTIMAÇÃO VIA DIÁRIO ELETRÔNICO PROCESSO: 1048808-80.2026.4.01.3900 CLASSE: PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL (436) POLO ATIVO: MARIA REPRESENTANTES POLO ATIVO: ROMULO ALVES COSTA - MA14427 POLO PASSIVO:INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS Destinatários: MARIA';
const CUMPRIMENTO = 'PROCESSO: 0801111-22.2025.8.10.0001 CLASSE: CUMPRIMENTO DE SENTENÇA (156) EXEQUENTE: FULANO EXECUTADO: BANCO X DESPACHO Intime-se';

describe('evento de cada comunicação', () => {
  it('lê o tipo do ato no começo do texto', () => {
    expect(eventoNoTexto(SENTENCA_TIPO_C)?.evento).toBe('sentenca');
    expect(eventoNoTexto(SENTENCA_TIPO_C)?.resultado).toBeUndefined(); // tipo C: sem mérito
    expect(eventoNoTexto(DESPACHO_CITADO)?.evento).toBe('citacao');
    expect(eventoNoTexto(TURMA_RECURSAL)?.evento).toBe('recurso');
    expect(eventoNoTexto(SO_CABECALHO)).toBeNull();
  });

  it('"cumprimento de sentença" é pagamento, não sentença', () => {
    expect(eventoNoTexto(CUMPRIMENTO)?.evento).toBe('pagamento');
  });

  it('não confunde "conclusos para sentença" nem "recurso" citado no fim de uma sentença', () => {
    expect(eventoNoTexto('DESPACHO Vista ao INSS. Após, venham os autos conclusos para sentença.')).toBeNull();
    const longa = 'SENTENÇA ' + 'x '.repeat(500) + 'JULGO PROCEDENTE o pedido. Havendo recurso inominado, intime-se para contrarrazões.';
    const a = eventoNoTexto(longa)!;
    expect(a.evento).toBe('sentenca');
    expect(a.resultado).toBe('procedente');
  });

  it('resultado da sentença', () => {
    expect(eventoNoTexto('SENTENÇA Ante o exposto, JULGO PARCIALMENTE PROCEDENTE')?.resultado).toBe('parcial');
    expect(eventoNoTexto('SENTENÇA Ante o exposto, JULGO IMPROCEDENTE o pedido')?.resultado).toBe('improcedente');
    expect(eventoNoTexto('Julgamento - Com Resolução do Mérito - Procedência')?.resultado).toBe('procedente');
  });

  it('nomes de movimento do DataJud', () => {
    expect(eventoNoTexto('Distribuição. Sorteio')?.evento).toBe('ajuizamento');
    expect(eventoNoTexto('Expedição de documento. Requisição de Pequeno Valor')?.evento).toBe('pagamento');
    expect(eventoNoTexto('Trânsito em julgado.')?.evento).toBe('sentenca');
  });
});

const processo = (movs: { data: string; nome: string; complemento?: string }[], tipo: Processo['tipo'] = 'JEF'): Processo => ({
  id: 'p1', numero: '1009628-57.2026.4.01.3900', tipo, clienteId: 'c1', assunto: '', responsavelId: '', valor: 0, regiao: '',
  etapas: [{ etapa: 'Entrada', data: '2026-01-05', obs: 'Importado pela OAB' }], grupoFamiliar: [], movimentosOficiais: movs,
});

describe('sugestões por processo', () => {
  const movs = [
    { data: '2026-08-10', nome: 'Intimação no DJEN — TRF1', complemento: TURMA_RECURSAL },
    { data: '2026-02-01', nome: 'Intimação no DJEN — TRF1', complemento: DESPACHO_CITADO },
    { data: '2026-05-20', nome: 'Intimação no DJEN — TRF1', complemento: SENTENCA_TIPO_C },
    { data: '2026-05-25', nome: 'Intimação no DJEN — TRF1', complemento: 'SENTENÇA Ante o exposto, JULGO PROCEDENTE' },
    { data: '2026-09-01', nome: 'Intimação no DJEN — TRF1', complemento: TURMA_RECURSAL },
  ];

  it('uma etapa por evento, na data da 1ª comunicação, em ordem', () => {
    const p = processo(movs);
    const s = sugerirEtapas(p, textosDoProcesso(p));
    expect(s.map((x) => [x.etapa, x.data])).toEqual([
      ['Citação/contestação', '2026-02-01'],
      ['Sentença', '2026-05-20'],
      ['Recurso', '2026-08-10'],
    ]);
    // Resultado vem de comunicação seguinte da mesma sentença
    expect(s[1].resultado).toBe('procedente');
    expect(faseComSugestoes(p, s)).toBe('Recurso');
  });

  it('pula etapas já registradas e processos administrativos', () => {
    const p = processo(movs);
    p.etapas.push({ etapa: 'Sentença', data: '2026-05-20' });
    expect(sugerirEtapas(p, textosDoProcesso(p)).map((x) => x.etapa)).toEqual(['Citação/contestação', 'Recurso']);
    const adm = processo(movs, 'ADM_INSS');
    expect(sugerirEtapas(adm, textosDoProcesso(adm))).toEqual([]);
  });

  it('usa a etapa certa de cada tipo', () => {
    const p = processo([{ data: '2026-03-01', nome: 'Intimação', complemento: CUMPRIMENTO }], 'CIVEL');
    expect(sugerirEtapas(p, textosDoProcesso(p)).map((x) => x.etapa)).toEqual(['Cumprimento']);
    const t = processo([{ data: '2026-03-01', nome: 'Intimação', complemento: CUMPRIMENTO }], 'TRABALHISTA');
    expect(sugerirEtapas(t, textosDoProcesso(t)).map((x) => x.etapa)).toEqual(['Execução']);
  });

  it('aplicar registra as etapas marcadas como automáticas, sem duplicar', () => {
    const p = processo(movs);
    const db = { processos: [p], registros: [] } as any;
    const s = sugerirEtapas(p, textosDoProcesso(p));
    aplicarSugestoes(db, 'p1', s);
    aplicarSugestoes(db, 'p1', s);
    expect(p.etapas.map((e) => e.etapa)).toEqual(['Entrada', 'Citação/contestação', 'Sentença', 'Recurso']);
    expect(p.etapas[2].obs).toMatch(/^Identificada pelas movimentações/);
    expect(db.registros).toHaveLength(0); // não conta como produção no Painel
    expect(sugerirEtapas(p, textosDoProcesso(p))).toEqual([]);
  });

  it('etapa automática removida ou ignorada não volta a ser sugerida', () => {
    const p = processo(movs);
    const db = { processos: [p], registros: [] } as any;
    aplicarSugestoes(db, 'p1', sugerirEtapas(p, textosDoProcesso(p)));
    removerEtapa(db, 'p1', p.etapas.findIndex((e) => e.etapa === 'Recurso'));
    ignorarSugestoes(db, 'p1', ['Citação/contestação']);
    p.etapas = p.etapas.filter((e) => e.etapa !== 'Citação/contestação');
    expect(sugerirEtapas(p, textosDoProcesso(p))).toEqual([]);
  });
});
