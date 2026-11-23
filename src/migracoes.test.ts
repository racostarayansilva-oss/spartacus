import { limparNomeParte, nomeProprio, poloPeloTexto } from './lib/importacao';
import { aplicarMigracoes, migracoesPendentes } from './migracoes';
import { ETIQUETAS_LEGIS, ETIQUETAS_TAREFA } from './lib/dadosIniciais';
import type { Banco } from './store';

const DESPACHO =
  'INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS DESPACHO Considerando que o INSS, devidamente citado, apresentou contestação no prazo legal, impugnando o pedido da parte autora';

describe('nome da parte sem o despacho grudado', () => {
  it('corta no DESPACHO (caso Joceli / Ester do print)', () => {
    expect(limparNomeParte(DESPACHO)).toBe('INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS');
    expect(nomeProprio(limparNomeParte('Instituto Nacional do Seguro Social - INSS DESPACHO Considerando que o INSS'))).toBe('Instituto Nacional do Seguro Social - INSS');
  });
  it('lê o polo passivo do texto sem levar o despacho', () => {
    expect(poloPeloTexto(`PROCESSO: 1 POLO ATIVO: JOCELI CRISTINA FURTADO DA SILVA REPRESENTANTES POLO ATIVO: ROMULO POLO PASSIVO: ${DESPACHO}`, 'PASSIVO'))
      .toBe('INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS');
  });
  it('não estraga nomes normais e limita tamanho', () => {
    expect(limparNomeParte('MARIA DAS GRAÇAS SOUZA')).toBe('MARIA DAS GRAÇAS SOUZA');
    expect(limparNomeParte('Bradesco Saude S/A')).toBe('Bradesco Saude S/A');
    expect(limparNomeParte('A '.repeat(100)).length).toBeLessThanOrEqual(100);
  });
});

describe('correções automáticas', () => {
  it('escritório novo ganha as etiquetas iniciais uma única vez, sem duplicar', () => {
    const db = { config: { etiquetas: [{ id: 'x', nome: 'RPV', cor: '#000' }], etiquetasTarefa: [] } } as unknown as Banco;
    expect(migracoesPendentes(db)).toHaveLength(1);
    aplicarMigracoes(db);
    expect(db.config.etiquetas).toHaveLength(ETIQUETAS_LEGIS.length); // RPV já existia
    expect(db.config.etiquetasTarefa).toHaveLength(ETIQUETAS_TAREFA.length);
    expect(migracoesPendentes(db)).toHaveLength(0);
  });
});
