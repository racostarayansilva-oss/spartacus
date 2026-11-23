import { buscarNormas, indexar, interpretar, ItemCatalogo, normalizarTexto, referenciaNorma } from './buscaNormas';

const CAT: ItemCatalogo[] = [
  ['1', 'LEI', '8213', '1991-07-24', 'Lei nº 8.213 de 24/07/1991', 'Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências.', ['Lei de Benefícios da Previdência Social']],
  ['2', 'DEC', '8213', '1941-11-13', 'Decreto nº 8.213 de 13/11/1941', 'AUTORIZA O CIDADÃO A PESQUISAR MANGANÊS.', []],
  ['3', 'DEL', '5452', '1943-05-01', 'Decreto-Lei nº 5.452 de 01/05/1943', 'Aprova a Consolidação das Leis do Trabalho.', ['Consolidação das Leis do Trabalho (CLT)']],
  ['4', 'LEI', '11718', '2008-06-20', 'Lei nº 11.718 de 20/06/2008', 'Acrescenta artigo à Lei nº 5.889, criando o contrato de trabalhador rural por pequeno prazo.', []],
  ['5', 'LEI', '15415', '2026-05-25', 'Lei nº 15.415 de 25/05/2026', 'Altera a Lei nº 8.213 para dispor sobre prazo para concessão do salário-maternidade.', []],
  ['6', 'DEC', '3048', '1999-05-06', 'Decreto nº 3.048 de 06/05/1999', 'APROVA O REGULAMENTO DA PREVIDENCIA SOCIAL.', []],
  ['7', 'DEC', '3048', '1938-09-08', 'Decreto nº 3.048 de 08/09/1938', 'DECLARA EXTINTOS CARGOS EXCEDENTES.', []],
  ['8', 'CON', '', '1988-10-05', 'Constituição da República Federativa do Brasil', '', []],
  ['9', 'LEI', '9000', '1995-03-16', 'Lei nº 9.000 de 16/03/1995', 'Abre crédito suplementar para aposentadoria de servidores rurais.', []],
  ['10', 'EMC', '103', '2019-11-12', 'Emenda Constitucional nº 103 de 12/11/2019', 'Altera o sistema de previdência social.', []],
];
const base = indexar(CAT);
const ids = (q: string, f = {}) => buscarNormas(base, q, f).itens.map((i) => i.item[0]);

describe('interpretar a busca', () => {
  it('tipo, número e ano em vários formatos', () => {
    expect(interpretar('lei 8213')).toMatchObject({ tipo: 'LEI', numero: '8213', termos: [] });
    expect(interpretar('8.213/91')).toMatchObject({ numero: '8213', ano: '1991' });
    expect(interpretar('Lei nº 13.105, de 16 de março de 2015')).toMatchObject({ tipo: 'LEI', numero: '13105', ano: '2015' });
    expect(interpretar('decreto-lei 5.452')).toMatchObject({ tipo: 'DEL', numero: '5452' });
    expect(interpretar('LC 142')).toMatchObject({ tipo: 'LCP', numero: '142' });
    expect(interpretar('EC 103/2019')).toMatchObject({ tipo: 'EMC', numero: '103', ano: '2019' });
    expect(interpretar('mp 1.164')).toMatchObject({ tipo: 'MPV', numero: '1164' });
  });
  it('artigo, apelidos e palavras', () => {
    expect(interpretar('art. 48 da 8213')).toMatchObject({ artigo: 'art48', numero: '8213' });
    expect(interpretar('CLT').apelido).toMatchObject({ tipo: 'DEL', numero: '5452' });
    expect(interpretar('art 20 da loas')).toMatchObject({ artigo: 'art20', apelido: { tipo: 'LEI', numero: '8742' } });
    expect(interpretar('Aposentadoria RURAL de 1991')).toMatchObject({ termos: ['aposentadoria', 'rural'], ano: '1991' });
  });
  it('sem acento e rápido', () => {
    expect(normalizarTexto('  SALÁRIO-MATERNIDADE  Ção ')).toBe('salario-maternidade cao');
  });
});

describe('buscar no catálogo', () => {
  it('número exato com a lei antes do decreto de mesmo número', () => {
    expect(ids('8213')).toEqual(['1', '2']);
    expect(ids('lei 8213')).toEqual(['1']);
    expect(ids('decreto 8213')).toEqual(['2']);
  });
  it('apelidos conhecidos vão direto na norma certa', () => {
    expect(ids('CLT')).toEqual(['3']);
    expect(ids('rps')).toEqual(['6']); // não traz o Decreto 3.048 de 1938
    expect(ids('constituição')).toEqual(['8']);
  });
  it('assunto traz as normas principais antes, mesmo sem a palavra na ementa', () => {
    const r = buscarNormas(base, 'aposentadoria rural');
    expect(r.itens[0].item[0]).toBe('1'); // Lei 8.213 é principal nos dois assuntos
    expect(r.itens[0].principal).toBe(true);
    // crédito orçamentário com as duas palavras fica depois das principais
    const pos = r.itens.findIndex((i) => i.item[0] === '9');
    expect(pos).toBeGreaterThan(r.itens.findIndex((i) => i.item[0] === '4'));
  });
  it('palavras na ementa e filtro por tipo/período', () => {
    expect(ids('salário maternidade')).toContain('5');
    expect(ids('previdencia', { tipo: 'DEC' })).toEqual(['6']);
    expect(ids('previdencia', { desde: '2000-01-01' })).not.toContain('6');
  });
  it('nada para buscar devolve vazio', () => {
    expect(buscarNormas(base, '').total).toBe(0);
  });
});

describe('referência para citar', () => {
  it('formata como se cita', () => {
    expect(referenciaNorma('LEI', '8213', '1991-07-24')).toBe('Lei nº 8.213, de 24 de julho de 1991');
    expect(referenciaNorma('DEL', '5452', '1943-05-01')).toBe('Decreto-Lei nº 5.452, de 1º de maio de 1943');
  });
});
