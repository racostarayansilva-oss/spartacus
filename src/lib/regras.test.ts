import { prazoJudicial, prazoCorrido, pascoa, emRecesso } from './prazos';
import { cpfValido, formatarCpf, mascararCpf } from './cpf';
import { aliasDataJud, calcularDv, cnjValido } from './cnj';
import { triagemGrupoFamiliar, MembroFamilia } from './triagem';
import { honorariosSobreRpv } from './honorarios';
import { classificar, alarmesProtocolo } from './whatsapp';
import { indicadoresFicha, vidaDoProcesso } from './etapas';
import { FICHAS, buscarFichas } from './normas';
import { idade, somarAnos } from './datas';

describe('prazos judiciais (CPC 219, 220, 224)', () => {
  it('pula fim de semana, Consciência Negra (20/11) e Dia da Justiça (08/12)', () => {
    const r = prazoJudicial('2026-11-13', 15);
    expect(r.publicacao).toBe('2026-11-16');
    expect(r.inicio).toBe('2026-11-17');
    expect(r.fatal).toBe('2026-12-09');
    expect(r.pulados.map((p) => p.data)).toContain('2026-11-20');
    expect(r.pulados.map((p) => p.data)).toContain('2026-12-08');
  });

  it('suspende no recesso de 20/12 a 20/01', () => {
    const r = prazoJudicial('2026-12-11', 15);
    expect(r.publicacao).toBe('2026-12-14');
    expect(r.fatal).toBe('2027-02-04');
  });

  it('embargos em 5 dias úteis', () => {
    expect(prazoJudicial('2026-11-04', 5).fatal).toBe('2026-11-12');
  });

  it('recesso inclui 20/12 e 20/01', () => {
    expect(emRecesso('2026-12-20')).toBe(true);
    expect(emRecesso('2027-01-20')).toBe(true);
    expect(emRecesso('2027-01-21')).toBe(false);
    expect(emRecesso('2026-12-19')).toBe(false);
  });

  it('Páscoa calculada corretamente', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });
});

describe('prazo corrido (exigência do INSS)', () => {
  it('30 dias corridos', () => {
    expect(prazoCorrido('2026-11-04', 30).fatal).toBe('2026-12-04');
  });
  it('vencendo no sábado vai para segunda', () => {
    expect(prazoCorrido('2026-11-05', 30).fatal).toBe('2026-12-07');
  });
});

describe('CPF', () => {
  it('valida dígitos', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
  it('formata e mascara', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(mascararCpf('52998224725')).toBe('529.***.***-25');
  });
});

describe('número CNJ', () => {
  const dv = calcularDv('1001234', '2025', '4', '01', '3700');
  const numero = `1001234-${dv}.2025.4.01.3700`;
  it('valida dígito verificador', () => {
    expect(cnjValido(numero)).toBe(true);
    expect(cnjValido(numero.replace(`-${dv}.`, `-${dv === '00' ? '01' : '00'}.`))).toBe(false);
  });
  it('acha o alias do DataJud', () => {
    expect(aliasDataJud(numero)).toBe('trf1');
    expect(aliasDataJud('0800123-45.2025.8.10.0001')).toBe('tjma');
    expect(aliasDataJud('0800123-45.2025.8.14.0001')).toBe('tjpa');
    expect(aliasDataJud('0000123-45.2025.5.16.0001')).toBe('trt16');
  });
});

describe('triagem do grupo familiar', () => {
  const ref = '2026-11-04';
  const m = (p: Partial<MembroFamilia>): MembroFamilia => ({ id: Math.random().toString(), nome: 'X', parentesco: 'titular', sexo: 'F', nascimento: '1990-01-01', ...p });
  it('aposentadoria rural 55/60 e janela de 5 anos', () => {
    const r = triagemGrupoFamiliar(
      [
        m({ nome: 'Maria', sexo: 'F', nascimento: '1970-05-10' }), // 56 anos: atingiu
        m({ nome: 'João', sexo: 'M', nascimento: '1968-03-01' }), // 58: completa 60 em 2028
        m({ nome: 'Pedro', sexo: 'M', nascimento: '1975-01-01' }), // 51: fora da janela
      ],
      ref,
    );
    expect(r.aposentadoriaRural.map((a) => [a.membro.nome, a.situacao])).toEqual([
      ['Maria', 'atingiu'],
      ['João', 'proximos5anos'],
    ]);
    expect(r.aposentadoriaRural[1].dataQueCompleta).toBe('2028-03-01');
  });
  it('salário-maternidade e BPC', () => {
    const r = triagemGrupoFamiliar(
      [
        m({ nome: 'Ana', ultimoParto: '2023-02-10' }),
        m({ nome: 'Bia', ultimoParto: '2020-01-01' }), // mais de 5 anos
        m({ nome: 'Cléo', partoPrevisto: '2027-01-15' }),
        m({ nome: 'Dona Rosa', nascimento: '1958-01-01' }),
      ],
      ref,
    );
    expect(r.salarioMaternidade.map((s) => s.membro.nome)).toEqual(['Ana', 'Cléo']);
    expect(r.salarioMaternidade[0].dataLimite).toBe('2028-02-10');
    expect(r.bpcIdoso.map((b) => b.membro.nome)).toEqual(['Dona Rosa']);
  });
});

describe('datas', () => {
  it('idade e 29/02', () => {
    expect(idade('2000-11-05', '2026-11-04')).toBe(25);
    expect(idade('2000-11-04', '2026-11-04')).toBe(26);
    expect(somarAnos('2024-02-29', 1)).toBe('2025-02-28');
  });
});

describe('honorários sobre RPV', () => {
  it('separa honorários e líquido', () => {
    expect(honorariosSobreRpv(42_360.5, 30)).toEqual({ valorRpv: 42360.5, percentual: 30, honorarios: 12708.15, liquidoCliente: 29652.35 });
  });
});

describe('WhatsApp', () => {
  it('classifica pedidos', () => {
    expect(classificar('Doutor, como anda meu processo?')).toBe('andamento');
    expect(classificar('me dê notícias')).toBe('andamento');
    expect(classificar('verifica meu processo por favor')).toBe('andamento');
    expect(classificar('doutor, protocola pra mim')).toBe('protocolo');
    expect(classificar('segue o RG da cliente')).toBe('documentos');
    expect(classificar('quando é a audiência?')).toBe('audiencia');
    expect(classificar('bom dia')).toBe('outros');
    expect(classificar('', true)).toBe('documentos');
  });
  it('alarmes de protocolo', () => {
    const a = alarmesProtocolo(
      [
        { id: '1', clienteId: 'c1', corretorId: 'k1', vezes: 3, situacao: 'pendente' },
        { id: '2', clienteId: 'c2', corretorId: 'k1', vezes: 1, situacao: 'pendente' },
        { id: '3', clienteId: 'c2', corretorId: 'k2', vezes: 1, situacao: 'pendente' },
      ],
      (id) => id,
      (id) => id,
    );
    expect(a.find((x) => x.tipo === 'repetido')?.texto).toBe('k1 pediu 3x o protocolo de c1');
    expect(a.find((x) => x.tipo === 'dois_corretores')?.clienteId).toBe('c2');
  });
});

describe('ficha do processo', () => {
  const etapas = [
    { etapa: 'Entrada', data: '2026-01-10' },
    { etapa: 'DER no INSS', data: '2026-02-01' },
    { etapa: 'Decisão INSS', data: '2026-06-01' },
  ];
  it('vida e indicadores', () => {
    expect(vidaDoProcesso(etapas).map((e) => e.diasDesdeAnterior)).toEqual([null, 22, 120]);
    expect(indicadoresFicha(etapas, '2026-11-04')).toEqual({ diasDeVida: 298, diasAteDecisao: 142, diasParado: 156 });
  });
});

describe('normas', () => {
  it('tem 24 fichas e busca por palavra', () => {
    expect(FICHAS).toHaveLength(24);
    expect(new Set(FICHAS.map((f) => f.id)).size).toBe(24);
    expect(buscarFichas('recesso').map((f) => f.id)).toContain('cpc-220');
    expect(buscarFichas('', 'JEF')).toHaveLength(2);
  });
});
