import { agruparPorProcesso, ComunicacaoDjen, montarImportacao, nomeProprio, poloPeloTexto, registroRetroativo, tipoPeloNumero } from './importacao';
import type { Banco } from '../store';

const com = (p: Partial<ComunicacaoDjen>): ComunicacaoDjen => ({
  id: Math.random().toString(36),
  disponibilizacao: '2026-11-04',
  tribunal: 'TRF1',
  processo: '1048808-80.2026.4.01.3900',
  orgao: '8ª Vara Federal de Juizado Especial Cível da SJPA',
  tipo: 'Intimação',
  classe: 'PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL',
  texto: '',
  partes: [],
  advogados: [{ nome: 'ROMULO ALVES COSTA', oab: 'MA 14427' }],
  ...p,
});

const bancoBase = (): Banco =>
  ({
    processos: [{ numero: '0801111-22.2025.8.10.0001' }],
    clientes: [{ id: 'c1', nome: 'Antônio Carlos Ribeiro' }],
    usuarios: [],
    config: { usuarioAtualId: 'u1' },
  }) as unknown as Banco;

describe('importação pela OAB (DJEN)', () => {
  it('formata nomes em maiúsculas', () => {
    expect(nomeProprio('MARIA DAS GRAÇAS SOUZA')).toBe('Maria das Graças Souza');
    expect(nomeProprio('INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS')).toBe('Instituto Nacional do Seguro Social - INSS');
    expect(nomeProprio('Já Formatado')).toBe('Já Formatado');
  });

  it('lê os polos pelo texto da intimação', () => {
    const t = 'PROCESSO: 1048808-80.2026.4.01.3900 CLASSE: X POLO ATIVO: MARIA ERNANDES RODRIGUES REPRESENTANTES POLO ATIVO: ROMULO ALVES COSTA - MA14427 POLO PASSIVO:INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS Destinatários: MARIA';
    expect(poloPeloTexto(t, 'ATIVO')).toBe('MARIA ERNANDES RODRIGUES');
    expect(poloPeloTexto(t, 'PASSIVO')).toBe('INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS');
  });

  it('tipo pelo número CNJ', () => {
    expect(tipoPeloNumero('1048808-80.2026.4.01.3900')).toBe('JEF');
    expect(tipoPeloNumero('0801111-22.2025.8.10.0001')).toBe('CIVEL');
    expect(tipoPeloNumero('0000123-45.2025.5.16.0001')).toBe('TRABALHISTA');
  });

  it('agrupa por processo, pega cliente do polo ativo e ignora o advogado', () => {
    const lista = [
      com({ disponibilizacao: '2026-03-01', partes: [{ nome: 'ROMULO ALVES COSTA', polo: 'A' }, { nome: 'MARIA ERNANDES RODRIGUES', polo: 'A' }] }),
      com({ disponibilizacao: '2026-11-04', partes: [{ nome: 'INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS', polo: 'P' }], orgao: 'Turma Recursal' }),
      com({ processo: '0801111-22.2025.8.10.0001', tribunal: 'TJMA', partes: [{ nome: 'ANTONIO CARLOS RIBEIRO', polo: 'A' }] }),
      com({ processo: '0000001-00.2026.8.10.0001', tribunal: 'TJMA', partes: [] }),
    ];
    const g = agruparPorProcesso(lista);
    expect(g).toHaveLength(3);
    const p = g.find((x) => x.digitos === '10488088020264013900')!;
    expect(p.cliente).toBe('MARIA ERNANDES RODRIGUES');
    expect(p.parteContraria).toBe('INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS');
    expect(p.primeira).toBe('2026-03-01');
    expect(p.orgao).toBe('Turma Recursal');
    expect(p.comunicacoes).toHaveLength(2);
  });

  it('cria só o que é novo e reaproveita clientes pelo nome', () => {
    let n = 0;
    const lista = [
      com({ partes: [{ nome: 'MARIA ERNANDES RODRIGUES', polo: 'A' }] }),
      com({ processo: '1000002-00.2026.4.01.3900', partes: [{ nome: 'MARIA ERNANDES RODRIGUES', polo: 'A' }] }),
      com({ processo: '0801111-22.2025.8.10.0001', partes: [{ nome: 'ANTONIO CARLOS RIBEIRO', polo: 'A' }] }), // já existe
      com({ processo: '0000001-00.2026.8.10.0001', partes: [] }), // sem cliente
    ];
    const r = montarImportacao(agruparPorProcesso(lista), bancoBase(), () => `id${++n}`, 'u1');
    expect(r.processos).toHaveLength(2);
    expect(r.clientesNovos.map((c) => c.nome)).toEqual(['Maria Ernandes Rodrigues']);
    expect(r.processos[0].clienteId).toBe(r.processos[1].clienteId);
    expect(r.jaExistentes).toBe(1);
    expect(r.semCliente).toHaveLength(1);
    expect(r.processos[0].tipo).toBe('JEF');
    expect(r.processos[0].movimentosOficiais?.length).toBe(1);
  });
});

describe('ajustes vistos com dados reais', () => {
  it('prefere pessoa física a empresa e formata classe com acento trocado', () => {
    const g = agruparPorProcesso([
      com({ processo: '0802290-31.2025.8.14.0060', tribunal: 'TJPA', classe: 'APELAçãO CíVEL', partes: [{ nome: 'BANCO BRADESCO SA', polo: 'A' }, { nome: 'DENISE RODRIGUES FREITAS', polo: 'P' }] }),
    ]);
    expect(g[0].cliente).toBe('DENISE RODRIGUES FREITAS');
    expect(g[0].poloCliente).toBe('P');
    expect(g[0].parteContraria).toBe('BANCO BRADESCO SA');
    expect(nomeProprio('APELAçãO CíVEL')).toBe('Apelação Cível');
    expect(nomeProprio('BANCO BRADESCO SA')).toBe('Banco Bradesco SA');
  });
});

describe('registro retroativo da importação', () => {
  it('conta os processos já importados e atribui à conta informada', () => {
    const banco = {
      processos: [
        { clienteId: 'c1', responsavelId: 'u-rayan', etapas: [{ etapa: 'Entrada', data: '2024-03-01', obs: 'Importado pela OAB — 1ª comunicação no DJEN em 01/03/2024' }] },
        { clienteId: 'c2', responsavelId: 'u-rayan', etapas: [{ etapa: 'Entrada', data: '2026-10-01', obs: 'Importado pela OAB — x' }] },
        { clienteId: 'c3', responsavelId: 'u1', etapas: [{ etapa: 'Entrada', data: '2026-01-01' }] },
      ],
      clientes: [{ id: 'c1', obs: 'Importado pela OAB (DJEN)' }, { id: 'c2', obs: 'Importado pela OAB (DJEN)' }, { id: 'c3' }],
      config: { oabs: [{ numero: '14427', uf: 'MA' }], importacoes: [] },
    } as unknown as Banco;
    const r = registroRetroativo(banco, () => 'id1', 'Rayan Silva', '2026-11-04T20:00:00Z')!;
    expect(r.processosNovos).toBe(2);
    expect(r.clientesNovos).toBe(2);
    expect(r.usuarioId).toBe('u-rayan');
    expect(r.usuarioNome).toBe('Rayan Silva');
    expect(r.periodo).toEqual({ inicio: '2024-03-01', fim: '2026-10-01' });
    // Só cria uma vez
    expect(registroRetroativo({ ...banco, config: { ...banco.config, importacoes: [r] } } as Banco, () => 'x', 'Rayan Silva', '')).toBeNull();
  });
});
