// Identifica a fase dos processos pelas movimentações já gravadas (DJEN, DataJud e intimações da Controladoria).
// Serve principalmente para os processos importados pela OAB, que entram só com a etapa "Entrada".
//
// Como funciona:
//  - Cada comunicação é um ato (despacho, decisão, sentença, acórdão…). Lemos o começo do texto, onde ficam
//    a classe ("RECURSO INOMINADO CÍVEL"), o órgão ("Turma Recursal") e o tipo do ato ("SENTENÇA").
//  - De cada ato vale só o evento mais avançado que ele revela (uma sentença que cita a contestação não vira citação).
//  - Para cada evento, a data é a da primeira comunicação em que ele aparece.
//  - É sugestão: a equipe revisa antes de aplicar. As etapas aplicadas não contam como produção no Painel.

import type { Banco, Processo } from '../store';
import { DataISO } from './datas';
import { ETAPAS, TipoProcesso } from './etapas';
import { somenteDigitos } from './cpf';

export type Evento = 'ajuizamento' | 'citacao' | 'audiencia' | 'sentenca' | 'recurso' | 'pagamento';

/** Do menos para o mais avançado. */
export const ORDEM_EVENTOS: Evento[] = ['ajuizamento', 'citacao', 'audiencia', 'sentenca', 'recurso', 'pagamento'];

const ETAPA_POR_EVENTO: Record<Evento, Partial<Record<TipoProcesso, string>>> = {
  ajuizamento: { JEF: 'Ajuizamento', CIVEL: 'Ajuizamento', TRABALHISTA: 'Ajuizamento' },
  citacao: { JEF: 'Citação/contestação', CIVEL: 'Citação/contestação' },
  audiencia: { JEF: 'Audiência/perícia', CIVEL: 'Audiência/perícia', TRABALHISTA: 'Audiência/perícia' },
  sentenca: { JEF: 'Sentença', CIVEL: 'Sentença', TRABALHISTA: 'Sentença' },
  recurso: { JEF: 'Recurso', CIVEL: 'Recurso', TRABALHISTA: 'Recurso' },
  pagamento: { JEF: 'RPV/pagamento', CIVEL: 'Cumprimento', TRABALHISTA: 'Execução' },
};

export function etapaDoEvento(tipo: TipoProcesso, ev: Evento): string | null {
  const e = ETAPA_POR_EVENTO[ev][tipo];
  return e && ETAPAS[tipo].includes(e) ? e : null;
}

export const MARCA_AUTOMATICA = 'Identificada pelas movimentações';

/** Tamanho do começo do texto onde ficam classe, órgão e tipo do ato. */
const CABECALHO = 700;

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Frases que citam a sentença sem que ela exista ainda, ou que são de outra fase.
const NAO_E_SENTENCA = /conclus[oa]s? (para|p\/) (a )?sentenca|para (prolacao de )?sentenca|(cumprimento|liquidacao|execucao) de sentenca/g;

const PADROES: { ev: Evento; re: RegExp; tudo?: boolean }[] = [
  // Pagamento: classe de cumprimento/execução ou expedição de RPV/precatório/alvará
  { ev: 'pagamento', re: /cumprimento de sentenca|execucao (de sentenca|contra a fazenda)|liquidacao de sentenca|expedi(cao|da|do|r) (de |a |o )?(rpv|requisicao|precatorio|alvara)|(rpv|requisicao de pequeno valor|precatorio) (expedid|paga|pago|liberad|depositad|cadastrad)|alvara (expedido|de levantamento)|requisicao de pequeno valor/ },
  // Recurso: classe/órgão de 2º grau ou acórdão
  { ev: 'recurso', re: /recurso inominado|turma recursal|turmas recursais|\bapelacao\b|\bapelante\b|recurso ordinario|recurso especial|recurso extraordinario|\bacordao\b|contrarrazoes|remessa .{0,40}(instancia superior|turma recursal|tribunal)/ },
  // Sentença: no cabeçalho do ato, ou o dispositivo em qualquer parte
  { ev: 'sentenca', re: /\bsentenca\b|\bprocedencia\b|\bimprocedencia\b|transit(o|ou) em julgado|extincao do processo/ },
  { ev: 'sentenca', re: /julgo (parcialmente )?(procedente|improcedente)|julgo extinto|extingo o processo|homologo (o )?acordo/, tudo: true },
  { ev: 'audiencia', re: /audiencia (de )?(instrucao|conciliacao|una|inicial|designada|redesignada|realizada)|designo (a )?audiencia|designada (a )?audiencia|\bpericia (medica|social|designada|agendada|realizada)|laudo pericial|\bperit[oa] (nomead|designad)/ },
  { ev: 'citacao', re: /devidamente citad|\bcite-se\b|\bcitacao\b|\bcitad[oa]\b|\bcontestacao\b|\bcontestou\b|apresentou contestacao/ },
  { ev: 'ajuizamento', re: /\bdistribuicao\b|\bdistribuido\b|peticao inicial/ },
];

export type ResultadoSentenca = 'procedente' | 'parcial' | 'improcedente';

function resultadoNoTexto(t: string): ResultadoSentenca | undefined {
  if (/parcialmente procedente|procedente em parte|procedencia em parte|procedencia parcial/.test(t)) return 'parcial';
  if (/improcedente|improcedencia/.test(t)) return 'improcedente';
  if (/julgo procedente|\bprocedencia\b|pedido procedente/.test(t)) return 'procedente';
  return undefined;
}

export interface Achado {
  evento: Evento;
  resultado?: ResultadoSentenca;
  /** Posição do trecho que indicou o evento (no texto normalizado, que tem o mesmo tamanho do original) */
  posicao: number;
}

/** O evento mais avançado que um ato revela, ou null. */
export function eventoNoTexto(texto: string): Achado | null {
  const completo = norm(texto);
  // Para procurar sentença, apaga as frases que citam a palavra sem ser sentença (mesmo tamanho, para manter a posição)
  const semFrases = completo.replace(NAO_E_SENTENCA, (m) => ' '.repeat(m.length));
  let melhor: Achado | null = null;
  for (const p of PADROES) {
    const base = p.ev === 'sentenca' ? semFrases : completo;
    const m = (p.tudo ? base : base.slice(0, CABECALHO)).match(p.re);
    if (!m || m.index === undefined) continue;
    if (melhor && ORDEM_EVENTOS.indexOf(melhor.evento) >= ORDEM_EVENTOS.indexOf(p.ev)) continue;
    melhor = { evento: p.ev, posicao: m.index };
  }
  if (melhor?.evento === 'sentenca') melhor.resultado = resultadoNoTexto(semFrases);
  return melhor;
}

export interface Sugestao {
  etapa: string;
  evento: Evento;
  data: DataISO;
  resultado?: ResultadoSentenca;
  /** Trecho que motivou a sugestão */
  trecho: string;
  /** De onde veio (ex.: "Intimação no DJEN — TRF1") */
  fonte: string;
}

export interface FonteTexto { data: string; titulo: string; texto: string }

/** Textos de um processo: movimentações gravadas + intimações da Controladoria com o mesmo número. */
export function textosDoProcesso(p: Processo, intimacoes: { disponibilizacao: string; tribunal: string; texto: string }[] = []): FonteTexto[] {
  return [
    ...(p.movimentosOficiais || []).map((m) => ({ data: String(m.data || '').slice(0, 10), titulo: m.nome, texto: `${m.nome}. ${m.complemento || ''}` })),
    ...intimacoes.map((i) => ({ data: i.disponibilizacao, titulo: `Intimação — ${i.tribunal}`, texto: i.texto })),
  ].filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.data));
}

function trechoEm(texto: string, posicao: number): string {
  const ini = Math.max(0, posicao - 40);
  const t = texto.slice(ini, posicao + 140).replace(/\s+/g, ' ').trim();
  return (ini > 0 ? '…' : '') + t + (posicao + 140 < texto.length ? '…' : '');
}

/** Etapas que as movimentações indicam e que ainda não estão registradas no processo. */
export function sugerirEtapas(p: Processo, fontes: FonteTexto[]): Sugestao[] {
  if (p.tipo === 'ADM_INSS') return [];
  const registradas = new Set([...p.etapas.map((e) => e.etapa), ...(p.etapasIgnoradas || [])]);
  const primeira = new Map<Evento, Sugestao>();
  const ordenadas = [...fontes].sort((a, b) => a.data.localeCompare(b.data));
  for (const f of ordenadas) {
    const a = eventoNoTexto(f.texto);
    if (!a) continue;
    const etapa = etapaDoEvento(p.tipo, a.evento);
    if (!etapa || registradas.has(etapa)) continue;
    const atual = primeira.get(a.evento);
    if (!atual) {
      primeira.set(a.evento, { etapa, evento: a.evento, data: f.data, resultado: a.resultado, trecho: trechoEm(f.texto, a.posicao), fonte: f.titulo });
    } else if (a.evento === 'sentenca' && !atual.resultado && a.resultado) {
      // A data é a da 1ª comunicação; o resultado pode aparecer numa comunicação seguinte da mesma sentença
      atual.resultado = a.resultado;
    }
  }
  return ORDEM_EVENTOS.map((e) => primeira.get(e)).filter((s): s is Sugestao => !!s);
}

/** Fase que o processo terá depois de aplicar as sugestões (a etapa mais recente; no empate, a mais avançada). */
export function faseComSugestoes(p: Processo, sugestoes: Sugestao[]): string {
  const todas = [...p.etapas.map((e) => ({ etapa: e.etapa, data: e.data })), ...sugestoes.map((s) => ({ etapa: s.etapa, data: s.data }))];
  if (!todas.length) return 'Entrada';
  const ordem = ETAPAS[p.tipo];
  return todas.sort((a, b) => a.data.localeCompare(b.data) || ordem.indexOf(a.etapa) - ordem.indexOf(b.etapa)).at(-1)!.etapa;
}

/** Sugestões de todos os processos (só os que têm alguma). */
export function sugestoesDoBanco(b: Banco): { p: Processo; sugestoes: Sugestao[] }[] {
  const intPorNumero = new Map<string, Banco['intimacoes']>();
  for (const i of b.intimacoes) {
    const k = somenteDigitos(i.processoNumero);
    if (!k) continue;
    if (!intPorNumero.has(k)) intPorNumero.set(k, []);
    intPorNumero.get(k)!.push(i);
  }
  const out: { p: Processo; sugestoes: Sugestao[] }[] = [];
  for (const p of b.processos) {
    const sugestoes = sugerirEtapas(p, textosDoProcesso(p, intPorNumero.get(somenteDigitos(p.numero)) || []));
    if (sugestoes.length) out.push({ p, sugestoes });
  }
  return out;
}

/** Descarta as sugestões: não aparecem mais para este processo. */
export function ignorarSugestoes(db: Banco, processoId: string, etapas: string[]) {
  const p = db.processos.find((x) => x.id === processoId);
  if (!p) return;
  p.etapasIgnoradas = [...new Set([...(p.etapasIgnoradas || []), ...etapas])];
}

/**
 * Registra as etapas sugeridas no processo, marcadas como automáticas.
 * Não cria produção no Painel: são fatos antigos, não trabalho feito hoje.
 */
export function aplicarSugestoes(db: Banco, processoId: string, sugestoes: Sugestao[]) {
  const p = db.processos.find((x) => x.id === processoId);
  if (!p) return;
  const registradas = new Set(p.etapas.map((e) => e.etapa));
  for (const s of sugestoes) {
    if (registradas.has(s.etapa)) continue;
    registradas.add(s.etapa);
    p.etapas.push({ etapa: s.etapa, data: s.data, resultado: s.etapa === 'Sentença' ? s.resultado : undefined, obs: `${MARCA_AUTOMATICA} (${s.fonte})` });
  }
}
