import { describe, expect, it } from 'vitest';
import { gruposDe, lerIntervalos, tamanhoLegivel } from './pdf';
import { detectar, INDICADORES } from './cnis';

describe('intervalos de páginas', () => {
  it('lê intervalos, páginas soltas e intervalos abertos', () => {
    expect(lerIntervalos('1-3, 5; 8-', 9)).toEqual([[0, 1, 2], [4], [7, 8]]);
    expect(lerIntervalos('-2', 5)).toEqual([[0, 1]]);
  });
  it('explica páginas inexistentes ou texto inválido', () => {
    expect(() => lerIntervalos('4-12', 10)).toThrow('10 páginas');
    expect(() => lerIntervalos('a-b', 10)).toThrow('Não entendi');
    expect(() => lerIntervalos(' ', 10)).toThrow('Informe');
  });
  it('divide em grupos de N páginas', () => {
    expect(gruposDe(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('mostra tamanhos legíveis', () => {
    expect(tamanhoLegivel(2048)).toBe('2 KB');
    expect(tamanhoLegivel(3.5 * 1024 * 1024)).toBe('3,50 MB');
  });
});

describe('indicadores do CNIS', () => {
  it('não repete siglas', () => {
    expect(new Set(INDICADORES.map((i) => i.sigla)).size).toBe(INDICADORES.length);
  });
  it('acha as siglas no texto colado, sem confundir siglas parecidas', () => {
    const r = detectar('01/2020 IREC-LC123-SUP\n02/2020 PEXT PEXT\nsem relação: XPEXT, IREC-LC123A');
    expect(r.map((x) => [x.ind.sigla, x.vezes])).toEqual([['PEXT', 2], ['IREC-LC123-SUP', 1]]);
  });
});
