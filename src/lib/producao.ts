// Produção da equipe: junta o que cada pessoa lançou (atividades) com o que o sistema já sabe
// (tarefas concluídas e movimentações registradas), pontua e monta ranking e relatório do dia.

import { Banco, RelatorioDiario, TipoAtividade, TipoRegistro } from '../store';
import { ROTULO_REGISTRO } from '../components/RegistrarMovimentacao';
import { DataISO, diaDaSemana, hoje, parse, somarDias } from './datas';

export const TIPOS_ATIVIDADE: Record<TipoAtividade, { rotulo: string; peso: number; icone: string }> = {
  atendimento: { rotulo: 'Atendimento', peso: 1, icone: 'clientes' },
  ligacao: { rotulo: 'Ligação / WhatsApp', peso: 1, icone: 'whatsapp' },
  peticao: { rotulo: 'Petição / peça', peso: 3, icone: 'documentos' },
  protocolo: { rotulo: 'Protocolo', peso: 2, icone: 'processos' },
  audiencia: { rotulo: 'Audiência / perícia', peso: 3, icone: 'martelo' },
  diligencia: { rotulo: 'Diligência externa', peso: 2, icone: 'alvo' },
  documento: { rotulo: 'Documentos / cadastro', peso: 1, icone: 'detalhe' },
  pesquisa: { rotulo: 'Pesquisa / análise', peso: 2, icone: 'busca' },
  reuniao: { rotulo: 'Reunião interna', peso: 1, icone: 'agenda' },
  outra: { rotulo: 'Outra', peso: 1, icone: 'pontos' },
};

export const PESO_REGISTRO: Record<TipoRegistro, number> = {
  entrada: 1, protocolo: 2, despacho: 1, sentenca: 2, recurso: 3, audiencia: 2, dilacao: 1, exigencia: 2,
};

export interface ItemProducao {
  id: string;
  origem: 'atividade' | 'tarefa' | 'registro';
  data: DataISO;
  usuarioId: string;
  titulo: string;
  tipo: string;
  icone: string;
  pontos: number;
  minutos: number;
  concluido: boolean;
  descricao?: string;
  processoId?: string | null;
  clienteId?: string | null;
}

const dentro = (d: DataISO | null | undefined, inicio: DataISO, fim: DataISO) => !!d && d >= inicio && d <= fim;

/** Tudo o que conta como produção no período (de uma pessoa ou da equipe toda). */
export function itensDoPeriodo(b: Banco, inicio: DataISO, fim: DataISO, usuarioId?: string): ItemProducao[] {
  const daPessoa = (id: string) => !usuarioId || id === usuarioId;
  const itens: ItemProducao[] = [];
  for (const a of b.atividades) {
    if (!dentro(a.data, inicio, fim) || !daPessoa(a.usuarioId)) continue;
    const t = TIPOS_ATIVIDADE[a.tipo] ?? TIPOS_ATIVIDADE.outra;
    const concluido = a.status === 'concluida';
    itens.push({
      id: a.id, origem: 'atividade', data: a.data, usuarioId: a.usuarioId, titulo: a.titulo, tipo: t.rotulo, icone: t.icone,
      pontos: concluido ? t.peso : 0, minutos: a.minutos ?? 0, concluido, descricao: a.descricao, processoId: a.processoId, clienteId: a.clienteId,
    });
  }
  for (const t of b.tarefas) {
    if (t.coluna !== 'concluido' || !dentro(t.concluidaEm, inicio, fim) || !daPessoa(t.responsavelId)) continue;
    itens.push({
      id: `tarefa:${t.id}`, origem: 'tarefa', data: t.concluidaEm!, usuarioId: t.responsavelId, titulo: t.titulo, tipo: 'Tarefa concluída', icone: 'feito',
      pontos: t.pontos, minutos: 0, concluido: true, processoId: t.processoId,
    });
  }
  for (const r of b.registros) {
    if (!dentro(r.data, inicio, fim) || !daPessoa(r.usuarioId)) continue;
    const rotulo = ROTULO_REGISTRO[r.tipo] ?? r.tipo;
    itens.push({
      id: `registro:${r.id}`, origem: 'registro', data: r.data, usuarioId: r.usuarioId, titulo: r.descricao?.trim() || rotulo, tipo: rotulo, icone: 'historico',
      pontos: PESO_REGISTRO[r.tipo] ?? 1, minutos: 0, concluido: true, processoId: r.processoId,
    });
  }
  return itens;
}

export const somaPontos = (itens: ItemProducao[]) => itens.reduce((s, i) => s + i.pontos, 0);
export const somaMinutos = (itens: ItemProducao[]) => itens.reduce((s, i) => s + i.minutos, 0);

export function formatarMinutos(min: number): string {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
}

export const ehDiaUtil = (d: DataISO) => { const s = diaDaSemana(d); return s !== 0 && s !== 6; };

export function diasUteis(inicio: DataISO, fim: DataISO): DataISO[] {
  const dias: DataISO[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) if (ehDiaUtil(d)) dias.push(d);
  return dias;
}

/** "2026-11" → ["2026-11-01", "2026-11-30"] */
export function intervaloDoMes(mes: string): [DataISO, DataISO] {
  const [a, m] = mes.split('-').map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return [`${mes}-01`, fim];
}

export function mesVizinho(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-11" → "Novembro de 2026" */
export const nomeDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
};

export interface LinhaRanking {
  usuarioId: string;
  nome: string;
  pontos: number;
  concluidos: number;
  minutos: number;
  atividades: number;
  tarefas: number;
  registros: number;
  relatorios: number;
  diasEsperados: number;
  /** 0 a 1: relatórios entregues ÷ dias úteis já passados no período */
  assiduidade: number;
}

/** Equipe (advogado + equipe) ordenada por pontos. `ate` limita os dias esperados (não cobra dia que não chegou). */
export function ranking(b: Banco, inicio: DataISO, fim: DataISO, ate: DataISO = hoje()): LinhaRanking[] {
  const limite = fim < ate ? fim : ate;
  const esperados = limite >= inicio ? diasUteis(inicio, limite).length : 0;
  const itens = itensDoPeriodo(b, inicio, fim);
  return b.usuarios
    .filter((u) => u.papel === 'advogado' || u.papel === 'equipe')
    .map((u) => {
      const meus = itens.filter((i) => i.usuarioId === u.id);
      const relatorios = new Set(b.relatoriosDiarios.filter((r) => r.usuarioId === u.id && dentro(r.data, inicio, fim)).map((r) => r.data)).size;
      return {
        usuarioId: u.id, nome: u.nome,
        pontos: somaPontos(meus),
        concluidos: meus.filter((i) => i.concluido).length,
        minutos: somaMinutos(meus),
        atividades: meus.filter((i) => i.origem === 'atividade').length,
        tarefas: meus.filter((i) => i.origem === 'tarefa').length,
        registros: meus.filter((i) => i.origem === 'registro').length,
        relatorios,
        diasEsperados: esperados,
        assiduidade: esperados ? Math.min(1, relatorios / esperados) : 0,
      };
    })
    .sort((x, y) => y.pontos - x.pontos || y.concluidos - x.concluidos || x.nome.localeCompare(y.nome));
}

export function pontosPorDia(itens: ItemProducao[], inicio: DataISO, fim: DataISO): { data: DataISO; pontos: number; itens: number }[] {
  const dias: { data: DataISO; pontos: number; itens: number }[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    const doDia = itens.filter((i) => i.data === d);
    dias.push({ data: d, pontos: somaPontos(doDia), itens: doDia.length });
  }
  return dias;
}

/** Pontos por tipo de entrega; além dos `max - 1` maiores, o resto vira "Outros". */
export function porTipo(itens: ItemProducao[], max = 7): { tipo: string; quantidade: number; pontos: number }[] {
  const mapa = new Map<string, { tipo: string; quantidade: number; pontos: number }>();
  for (const i of itens) {
    const x = mapa.get(i.tipo) ?? { tipo: i.tipo, quantidade: 0, pontos: 0 };
    x.quantidade++;
    x.pontos += i.pontos;
    mapa.set(i.tipo, x);
  }
  const todos = [...mapa.values()].sort((a, b) => b.pontos - a.pontos || b.quantidade - a.quantidade);
  if (todos.length <= max) return todos;
  const resto = todos.slice(max - 1);
  return [...todos.slice(0, max - 1), { tipo: 'Outros', quantidade: resto.reduce((s, x) => s + x.quantidade, 0), pontos: resto.reduce((s, x) => s + x.pontos, 0) }];
}

/** Texto inicial do relatório do dia, montado com o que a pessoa fez. Ela revisa antes de entregar. */
export function resumoAutomatico(itens: ItemProducao[]): string {
  const feitos = itens.filter((i) => i.concluido);
  const andamento = itens.filter((i) => !i.concluido);
  if (!itens.length) return '';
  const linhas: string[] = [];
  const tempo = somaMinutos(itens);
  const entregas = feitos.length
    ? `${feitos.length} ${feitos.length === 1 ? 'entrega concluída' : 'entregas concluídas'} (${somaPontos(itens)} pts)`
    : 'Nenhuma entrega concluída ainda';
  linhas.push(`${entregas}${tempo ? ` · ${formatarMinutos(tempo)} de trabalho registrado` : ''}.`);
  for (const i of feitos) linhas.push(`• ${i.tipo}: ${i.titulo}`);
  if (andamento.length) {
    linhas.push('Em andamento:');
    for (const i of andamento) linhas.push(`• ${i.titulo}`);
  }
  return linhas.join('\n');
}

/** Pendências sugeridas: tarefas abertas da pessoa vencidas ou vencendo até o dia seguinte. */
export function pendenciasSugeridas(b: Banco, usuarioId: string, data: DataISO): string {
  const ate = somarDias(data, 1);
  return b.tarefas
    .filter((t) => t.coluna !== 'concluido' && t.prazo && t.prazo <= ate && (t.responsavelId === usuarioId || t.participantes?.includes(usuarioId)))
    .sort((x, y) => (x.prazo! < y.prazo! ? -1 : 1))
    .map((t) => `• ${t.titulo} (prazo ${t.prazo!.slice(8, 10)}/${t.prazo!.slice(5, 7)})`)
    .join('\n');
}

export const idRelatorio = (usuarioId: string, data: DataISO) => `${usuarioId}:${data}`;

/** Dias úteis seguidos com relatório entregue, contando para trás a partir de `data` (o dia de hoje ainda aberto não quebra a sequência). */
export function sequencia(relatorios: RelatorioDiario[], usuarioId: string, data: DataISO = hoje()): number {
  const entregues = new Set(relatorios.filter((r) => r.usuarioId === usuarioId).map((r) => r.data));
  let d = data;
  if (!entregues.has(d)) d = somarDias(d, -1);
  let n = 0;
  for (let i = 0; i < 400; i++, d = somarDias(d, -1)) {
    if (!ehDiaUtil(d)) continue;
    if (!entregues.has(d)) break;
    n++;
  }
  return n;
}

export function csvDoMes(linhas: LinhaRanking[]): string {
  const cab = ['Posição', 'Pessoa', 'Pontos', 'Entregas concluídas', 'Atividades', 'Tarefas', 'Movimentações', 'Horas registradas', 'Relatórios entregues', 'Dias úteis', 'Assiduidade (%)'];
  const esc = (v: string | number) => { const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const corpo = linhas.map((l, i) => [i + 1, l.nome, l.pontos, l.concluidos, l.atividades, l.tarefas, l.registros, (l.minutos / 60).toFixed(1).replace('.', ','), l.relatorios, l.diasEsperados, Math.round(l.assiduidade * 100)]);
  return '﻿' + [cab, ...corpo].map((l) => l.map(esc).join(';')).join('\n');
}

export const diaCurto = (d: DataISO) => parse(d).getUTCDate();
