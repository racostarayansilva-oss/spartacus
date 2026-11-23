// Relatório de processos do Legis (CSV com ";"): cria os processos que faltam e atualiza valor da causa e fase.
// Colunas: Número, Título ("AUTOR + 1 x RÉU + 1"), Status, Fase, Comarca, UF, Tribunal, Responsável, Valor da Causa, Distribuição, Última Movimentação.
import type { Banco, Cliente, Processo } from '../store';
import { lerCsv, dataLegis } from './importarLegis';
import { CLIENTE_A_IDENTIFICAR, nomeProprio, normalizar, tipoPeloNumero } from './importacao';
import { parseCnj } from './cnj';

export interface ProcessoLegis {
  digitos: string; numero: string; autor: string; reu: string; fase?: Processo['faseLegis'];
  comarca: string; uf: string; valor: number; distribuicao?: string;
}

const FASE: Record<string, Processo['faseLegis']> = { instrucao: 'instrucao', recursal: 'recursal', execucao: 'execucao' };
const PRIORIDADE = { execucao: 3, recursal: 2, instrucao: 1 } as const;
const vazio = (s: string) => !s || /^[—–-]$/.test(s.trim());
const semMais = (s: string) => s.replace(/\s*\+\s*\d+\s*$/, '').trim();

/** "R$ 6.484,00" → 6484 */
export function valorLegis(s: string): number {
  const n = Number((s || '').replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Um item por número (o Legis repete o processo em cada instância): maior valor, fase mais adiantada, título com nome. */
export function processosDoRelatorio(texto: string): ProcessoLegis[] {
  const [cab, ...linhas] = lerCsv(texto);
  if (!cab) return [];
  const col = (n: string) => cab.findIndex((c) => normalizar(c) === normalizar(n));
  const i = { num: col('Número'), tit: col('Título'), fase: col('Fase'), com: col('Comarca'), uf: col('UF'), val: col('Valor da Causa'), dist: col('Distribuição') };
  if (i.num < 0 || i.tit < 0) throw new Error('Arquivo sem as colunas "Número" e "Título". Exporte o relatório de processos do Legis em CSV.');
  const v = (l: string[], k: number) => (k >= 0 && !vazio(l[k] || '') ? (l[k] || '').trim().replace(/\s+/g, ' ') : '');
  const mapa = new Map<string, ProcessoLegis>();
  for (const l of linhas) {
    const cnj = parseCnj(v(l, i.num));
    if (!cnj) continue;
    const titulo = v(l, i.tit);
    const generico = /^processo n/i.test(titulo);
    const [autor = '', reu = ''] = generico ? [] : titulo.split(/\s+x\s+/i);
    const fase = FASE[normalizar(v(l, i.fase))];
    const item: ProcessoLegis = {
      digitos: cnj.digitos, numero: cnj.formatado, autor: semMais(autor), reu: semMais(reu), fase,
      comarca: v(l, i.com), uf: v(l, i.uf), valor: valorLegis(v(l, i.val)), distribuicao: dataLegis(v(l, i.dist)),
    };
    const a = mapa.get(cnj.digitos);
    if (!a) { mapa.set(cnj.digitos, item); continue; }
    a.valor = Math.max(a.valor, item.valor);
    if (item.fase && (!a.fase || PRIORIDADE[item.fase] > PRIORIDADE[a.fase])) a.fase = item.fase;
    if (!a.autor && item.autor) { a.autor = item.autor; a.reu = item.reu; }
    if (!a.comarca && item.comarca) { a.comarca = item.comarca; a.uf = item.uf; }
    if (item.distribuicao && (!a.distribuicao || item.distribuicao < a.distribuicao)) a.distribuicao = item.distribuicao;
  }
  return [...mapa.values()];
}

export interface PlanoProcessosLegis {
  processosNovos: Processo[];
  clientesNovos: Cliente[];
  atualizados: { id: string; valor?: number; faseLegis?: Processo['faseLegis'] }[];
  semMudanca: number;
}

/** O que gravar: processos e clientes novos; valor (se o Legis tiver) e fase dos que já existem. */
export function planejarProcessosLegis(
  itens: ProcessoLegis[], b: Pick<Banco, 'processos' | 'clientes'>, novoId: () => string, hoje: string,
): PlanoProcessosLegis {
  const plano: PlanoProcessosLegis = { processosNovos: [], clientesNovos: [], atualizados: [], semMudanca: 0 };
  const porDigitos = new Map(b.processos.map((p) => [p.numero.replace(/\D/g, ''), p]));
  const clientes = new Map(b.clientes.map((c) => [normalizar(c.nome), c]));
  for (const it of itens) {
    const p = porDigitos.get(it.digitos);
    if (p) {
      const mud: PlanoProcessosLegis['atualizados'][number] = { id: p.id };
      if (it.valor > 0 && it.valor !== p.valor) mud.valor = it.valor;
      if (it.fase && it.fase !== p.faseLegis) mud.faseLegis = it.fase;
      if (mud.valor !== undefined || mud.faseLegis) plano.atualizados.push(mud); else plano.semMudanca++;
      continue;
    }
    const nome = it.autor ? nomeProprio(it.autor) : CLIENTE_A_IDENTIFICAR;
    let c = clientes.get(normalizar(nome));
    if (!c) {
      c = { id: novoId(), nome, cpf: '', telefone: '', origem: 'nao_informada', criadoEm: it.distribuicao || hoje, obs: 'Importado do Legis (relatório de processos)' };
      clientes.set(normalizar(nome), c);
      plano.clientesNovos.push(c);
    }
    const data = it.distribuicao || hoje;
    plano.processosNovos.push({
      id: novoId(), numero: it.numero, tipo: tipoPeloNumero(it.numero), clienteId: c.id,
      assunto: it.reu ? `Processo judicial — contra ${nomeProprio(it.reu)}` : 'Processo judicial',
      responsavelId: '', valor: it.valor, corretorId: null,
      regiao: [nomeProprio(it.comarca), it.uf].filter(Boolean).join(' — '),
      etapas: [{ etapa: 'Entrada', data, obs: `Importado do Legis — distribuído em ${data.split('-').reverse().join('/')}` }],
      grupoFamiliar: [], faseLegis: it.fase,
    });
    porDigitos.set(it.digitos, plano.processosNovos[plano.processosNovos.length - 1]);
  }
  return plano;
}
