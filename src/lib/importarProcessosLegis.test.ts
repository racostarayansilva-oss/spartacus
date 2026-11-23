import { planejarProcessosLegis, processosDoRelatorio, valorLegis } from './importarProcessosLegis';
import type { Banco } from '../store';

const CSV = `Número;Título;Status;Fase;Comarca;UF;Tribunal;Responsável;Valor da Causa;Distribuição;Última Movimentação
1000180-94.2025.4.01.3900;ZILDA GONCALVES x INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS;Ativo;Instrução;SECAO JUDICIARIA DO PARA;PA;—;—;R$ 10.000,00;04/01/2025;23/06/2026
1000180-94.2025.4.01.3900;ZILDA GONCALVES x INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS;Ativo;Recursal;NUCLEOS DE JUSTICA 4.0;PA;—;—;R$ 0,00;22/06/2026;19/11/2026
0000011-92.2023.5.08.0125;FRANCISCO COSTA DA SILVA + 1 x TAUA BRASIL PALMA S.A + 1;Ativo;Instrução;ABAETETUBA;PA;—;—;R$ 204.534,23;11/01/2023;10/11/2026
0600037-80.2026.6.10.0033;Processo nº 0600037-80.2026.6.10.0033 (primeira);Ativo;Instrução;IMPERATRIZ;PA;—;—;R$ 0,00;04/06/2026;16/11/2026
1055676-74.2026.4.01.3900;MARIA DO SOCORRO FERREIRA RAMOS x INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS;Ativo;Execução;SECAO JUDICIARIA DO PARA;PA;—;—;R$ 6.484,00;21/08/2026;13/11/2026
1001745-59.2026.4.01.3900;RENAN MOREIRA DA COSTA ;Ativo;;SECAO JUDICIARIA DO PARA;PA;;—;—;—;22/07/2026
`;

describe('relatório de processos do Legis', () => {
  it('lê valores e junta o mesmo processo em instâncias diferentes', () => {
    expect(valorLegis('R$ 204.534,23')).toBe(204534.23);
    expect(valorLegis('—')).toBe(0);
    const l = processosDoRelatorio(CSV);
    expect(l).toHaveLength(5);
    const zilda = l.find((p) => p.autor === 'ZILDA GONCALVES')!;
    expect(zilda).toMatchObject({ valor: 10000, fase: 'recursal', distribuicao: '2025-01-04', comarca: 'SECAO JUDICIARIA DO PARA' });
    expect(l.find((p) => p.numero === '0000011-92.2023.5.08.0125')).toMatchObject({ autor: 'FRANCISCO COSTA DA SILVA', reu: 'TAUA BRASIL PALMA S.A' });
    expect(l.find((p) => p.numero === '0600037-80.2026.6.10.0033')?.autor).toBe('');
    expect(l.find((p) => p.numero === '1001745-59.2026.4.01.3900')).toMatchObject({ autor: 'RENAN MOREIRA DA COSTA', reu: '', valor: 0 });
  });

  it('cria só os que faltam, reaproveita cliente pelo nome e atualiza valor e fase dos existentes', () => {
    const b = {
      processos: [{ id: 'p1', numero: '10556767420264013900', clienteId: 'c1', valor: 6900, etapas: [] }],
      clientes: [{ id: 'c1', nome: 'Maria do Socorro Ferreira Ramos' }, { id: 'c2', nome: 'Zilda Goncalves' }],
    } as unknown as Banco;
    let n = 0;
    const plano = planejarProcessosLegis(processosDoRelatorio(CSV), b, () => `n${++n}`, '2026-11-19');
    expect(plano.atualizados).toEqual([{ id: 'p1', valor: 6484, faseLegis: 'execucao' }]);
    expect(plano.processosNovos).toHaveLength(4);
    const zilda = plano.processosNovos.find((p) => p.numero === '1000180-94.2025.4.01.3900')!;
    expect(zilda).toMatchObject({ clienteId: 'c2', valor: 10000, faseLegis: 'recursal', tipo: 'JEF', regiao: 'Secao Judiciaria do Para — PA', assunto: 'Processo judicial — contra Instituto Nacional do Seguro Social - INSS' });
    expect(zilda.etapas[0]).toMatchObject({ etapa: 'Entrada', data: '2025-01-04' });
    expect(plano.clientesNovos.map((c) => c.nome)).toEqual(['Francisco Costa da Silva', 'Cliente a identificar', 'Renan Moreira da Costa']);
    // Reimportar depois de gravar: nada novo
    const depois = { processos: [...b.processos, ...plano.processosNovos], clientes: [...b.clientes, ...plano.clientesNovos] } as unknown as Banco;
    depois.processos[0].valor = 6484; (depois.processos[0] as any).faseLegis = 'execucao';
    const de_novo = planejarProcessosLegis(processosDoRelatorio(CSV), depois, () => 'x', '2026-11-19');
    expect(de_novo).toMatchObject({ processosNovos: [], clientesNovos: [], atualizados: [], semMudanca: 5 });
  });
});
