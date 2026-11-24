// Cálculo de prazos.
// Judicial (CPC arts. 219, 220 e 224):
//   1. Disponibilização no DJe.
//   2. Publicação = 1º dia útil seguinte à disponibilização (art. 224, §2º).
//   3. O prazo começa no 1º dia útil seguinte à publicação (art. 224, §3º).
//   4. Contam só dias úteis (art. 219), pulando fins de semana, feriados e o recesso de 20/12 a 20/01 (art. 220).
// Administrativo INSS (exigência, recurso ao CRPS): dias corridos, excluindo o dia do começo; se o
//   último dia cair em dia não útil, passa para o próximo dia útil (Lei 9.784/99, art. 66).

import { DataISO, diaDaSemana, iso, parse, somarDias } from './datas.js';

export type EscopoFeriado = 'nacional' | 'forense' | 'MA' | 'PA' | 'municipal';

export interface Feriado {
  data: DataISO;
  nome: string;
  escopo: EscopoFeriado;
  /** true = precisa ser conferido no calendário do tribunal antes de confiar */
  conferir?: boolean;
}

export interface OpcoesCalendario {
  /** UFs cujos feriados estaduais entram na conta */
  ufs?: string[];
  /** Feriados forenses da Justiça Federal (Lei 5.010/66, art. 62). Padrão: true */
  forense?: boolean;
  /** Feriados municipais, pontos facultativos e suspensões cadastrados pelo escritório */
  extras?: Feriado[];
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(Date.UTC(ano, mes - 1, dia)));
}

export function feriadosDoAno(ano: number, opcoes: OpcoesCalendario = {}): Feriado[] {
  const { ufs = ['MA', 'PA'], forense = true, extras = [] } = opcoes;
  const f = (mmdd: string, nome: string, escopo: EscopoFeriado, conferir = false): Feriado => ({
    data: `${ano}-${mmdd}`,
    nome,
    escopo,
    conferir,
  });
  const p = pascoa(ano);
  const lista: Feriado[] = [
    f('01-01', 'Confraternização Universal', 'nacional'),
    { data: somarDias(p, -2), nome: 'Sexta-feira Santa', escopo: 'nacional' },
    f('04-21', 'Tiradentes', 'nacional'),
    f('05-01', 'Dia do Trabalho', 'nacional'),
    f('09-07', 'Independência', 'nacional'),
    f('10-12', 'Nossa Senhora Aparecida', 'nacional'),
    f('11-02', 'Finados', 'nacional'),
    f('11-15', 'Proclamação da República', 'nacional'),
    f('11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
    f('12-25', 'Natal', 'nacional'),
  ];
  if (forense) {
    lista.push(
      { data: somarDias(p, -48), nome: 'Carnaval (segunda)', escopo: 'forense' },
      { data: somarDias(p, -47), nome: 'Carnaval (terça)', escopo: 'forense' },
      { data: somarDias(p, -4), nome: 'Semana Santa (quarta)', escopo: 'forense' },
      { data: somarDias(p, -3), nome: 'Semana Santa (quinta)', escopo: 'forense' },
      { data: somarDias(p, 60), nome: 'Corpus Christi', escopo: 'forense', conferir: true },
      f('08-11', 'Dia do Advogado / Criação dos cursos jurídicos', 'forense'),
      f('11-01', 'Todos os Santos', 'forense'),
      f('12-08', 'Dia da Justiça', 'forense'),
    );
  }
  if (ufs.includes('MA')) {
    lista.push(f('07-28', 'Adesão do Maranhão à Independência', 'MA', true));
  }
  if (ufs.includes('PA')) {
    lista.push(f('08-15', 'Adesão do Pará à Independência', 'PA', true));
  }
  for (const e of extras) if (e.data.startsWith(String(ano))) lista.push(e);
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

/** Recesso forense: 20/12 a 20/01, inclusive (CPC, art. 220). */
export function emRecesso(d: DataISO): boolean {
  const md = d.slice(5);
  return md >= '12-20' || md <= '01-20';
}

export class Calendario {
  private cache = new Map<number, Map<DataISO, Feriado>>();
  constructor(private opcoes: OpcoesCalendario = {}) {}

  feriado(d: DataISO): Feriado | undefined {
    const ano = parse(d).getUTCFullYear();
    if (!this.cache.has(ano)) {
      this.cache.set(ano, new Map(feriadosDoAno(ano, this.opcoes).map((f) => [f.data, f])));
    }
    return this.cache.get(ano)!.get(d);
  }

  /** Motivo de o dia não ser útil, ou null se for útil. */
  motivoNaoUtil(d: DataISO, considerarRecesso = true): string | null {
    const dow = diaDaSemana(d);
    if (dow === 0) return 'domingo';
    if (dow === 6) return 'sábado';
    const fer = this.feriado(d);
    if (fer) return fer.nome + (fer.conferir ? ' (conferir)' : '');
    if (considerarRecesso && emRecesso(d)) return 'recesso forense (CPC, art. 220)';
    return null;
  }

  ehUtil(d: DataISO, considerarRecesso = true): boolean {
    return this.motivoNaoUtil(d, considerarRecesso) === null;
  }

  proximoUtil(d: DataISO, considerarRecesso = true): DataISO {
    let x = somarDias(d, 1);
    while (!this.ehUtil(x, considerarRecesso)) x = somarDias(x, 1);
    return x;
  }
}

export interface DiaPulado {
  data: DataISO;
  motivo: string;
}

export interface ResultadoPrazo {
  disponibilizacao?: DataISO;
  publicacao?: DataISO;
  inicio: DataISO;
  fatal: DataISO;
  dias: number;
  modo: 'uteis' | 'corridos';
  pulados: DiaPulado[];
  avisos: string[];
}

/** Prazo judicial a partir da disponibilização no DJe. */
export function prazoJudicial(
  disponibilizacao: DataISO,
  dias: number,
  opcoes: OpcoesCalendario = {},
): ResultadoPrazo {
  const cal = new Calendario(opcoes);
  const publicacao = cal.proximoUtil(disponibilizacao);
  const r = contarDiasUteis(publicacao, dias, cal);
  return { ...r, disponibilizacao, publicacao };
}

/** Prazo em dias úteis a partir de uma data de intimação/ciência (o prazo começa no dia útil seguinte). */
export function prazoDiasUteis(
  ciencia: DataISO,
  dias: number,
  opcoes: OpcoesCalendario = {},
): ResultadoPrazo {
  return contarDiasUteis(ciencia, dias, new Calendario(opcoes));
}

function contarDiasUteis(base: DataISO, dias: number, cal: Calendario): ResultadoPrazo {
  if (!Number.isInteger(dias) || dias < 1) throw new Error('Informe um número de dias inteiro e positivo.');
  const pulados: DiaPulado[] = [];
  let x = base;
  let contados = 0;
  let inicio = '';
  while (contados < dias) {
    x = somarDias(x, 1);
    const motivo = cal.motivoNaoUtil(x);
    if (motivo) {
      pulados.push({ data: x, motivo });
      continue;
    }
    if (!inicio) inicio = x;
    contados++;
  }
  const avisos = pulados
    .filter((p) => p.motivo.includes('conferir'))
    .map((p) => `${p.data}: ${p.motivo} — confira no calendário do tribunal.`);
  avisos.push('Feriados municipais (São Luís, Tomé-Açu, Breves) e suspensões de expediente devem estar cadastrados para entrar na conta.');
  return { inicio, fatal: x, dias, modo: 'uteis', pulados, avisos };
}

/** Prazo administrativo em dias corridos (ex.: exigência do INSS, 30 dias). */
export function prazoCorrido(
  ciencia: DataISO,
  dias: number,
  opcoes: OpcoesCalendario = {},
): ResultadoPrazo {
  if (!Number.isInteger(dias) || dias < 1) throw new Error('Informe um número de dias inteiro e positivo.');
  const cal = new Calendario({ ...opcoes, forense: false });
  const inicio = somarDias(ciencia, 1);
  let fatal = somarDias(ciencia, dias);
  const pulados: DiaPulado[] = [];
  while (!cal.ehUtil(fatal, false)) {
    pulados.push({ data: fatal, motivo: cal.motivoNaoUtil(fatal, false)! });
    fatal = somarDias(fatal, 1);
  }
  return {
    inicio,
    fatal,
    dias,
    modo: 'corridos',
    pulados,
    avisos: ['Prazo administrativo em dias corridos; se vencer em dia sem expediente, prorroga para o próximo dia útil.'],
  };
}

/** Prazos mais usados, para preencher a calculadora com um clique. */
export const PRAZOS_COMUNS: { nome: string; dias: number; modo: 'uteis' | 'corridos'; base: string }[] = [
  { nome: 'Contestação', dias: 15, modo: 'uteis', base: 'CPC, art. 335' },
  { nome: 'Apelação / recursos em geral', dias: 15, modo: 'uteis', base: 'CPC, art. 1.003, §5º' },
  { nome: 'Embargos de declaração', dias: 5, modo: 'uteis', base: 'CPC, art. 1.023' },
  { nome: 'Recurso inominado (JEF)', dias: 10, modo: 'uteis', base: 'Lei 9.099/95, arts. 12-A e 42' },
  { nome: 'Exigência do INSS', dias: 30, modo: 'corridos', base: 'IN PRES/INSS 212/2026' },
  { nome: 'Recurso ao CRPS', dias: 30, modo: 'corridos', base: 'Decreto 3.048/99, art. 305' },
];

/** Usado para checar se uma data já passou ou vence hoje. */
export function situacaoPrazo(fatal: DataISO, referencia: DataISO): 'vencido' | 'hoje' | 'proximo' | 'futuro' {
  if (fatal < referencia) return 'vencido';
  if (fatal === referencia) return 'hoje';
  if (fatal <= somarDias(referencia, 3)) return 'proximo';
  return 'futuro';
}
