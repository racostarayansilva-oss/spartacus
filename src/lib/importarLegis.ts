// Importação das tarefas exportadas do Legis (Relatório → CSV).
// Colunas: Título, Status, Prioridade, Complexidade, Tipo, Processo, Prazo, Responsáveis, Criado em, Conclusão.
// Reimportar o mesmo arquivo atualiza as tarefas em vez de duplicar (o id vem do título + data de criação + processo).
import type { Banco, Tarefa, Usuario } from '../store';
import { normalizar } from './importacao';

export interface LinhaLegis {
  titulo: string; status: string; prioridade: string; complexidade: string; tipo: string;
  processo: string; prazo?: string; responsaveis: string[]; criadoEm?: string; conclusao?: string;
}

/** CSV com aspas (RFC 4180), vírgula ou ponto e vírgula. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

const vazio = (s: string | undefined) => !s || /^[—–-]?$/.test(s.trim());
/** "18/11/2026" → "2026-11-18" */
export function dataLegis(s: string | undefined): string | undefined {
  const m = (s || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

export function linhasLegis(texto: string): LinhaLegis[] {
  const [cab, ...resto] = lerCsv(texto);
  if (!cab) return [];
  const col = (nome: string) => cab.findIndex((c) => normalizar(c) === normalizar(nome));
  const i = {
    titulo: col('Título'), status: col('Status'), prioridade: col('Prioridade'), complexidade: col('Complexidade'), tipo: col('Tipo'),
    processo: col('Processo'), prazo: col('Prazo'), resp: col('Responsáveis'), criado: col('Criado em'), conclusao: col('Conclusão'),
  };
  if (i.titulo < 0 || i.status < 0) throw new Error('Arquivo sem as colunas "Título" e "Status". Exporte o relatório de tarefas do Legis em CSV.');
  const v = (l: string[], k: number) => (k >= 0 ? (l[k] || '').trim() : '');
  return resto
    .filter((l) => v(l, i.titulo))
    .map((l) => ({
      titulo: v(l, i.titulo).replace(/\s+/g, ' '), status: v(l, i.status), prioridade: v(l, i.prioridade), complexidade: v(l, i.complexidade),
      tipo: v(l, i.tipo), processo: vazio(v(l, i.processo)) ? '' : v(l, i.processo).replace(/\s+/g, ' '),
      prazo: dataLegis(v(l, i.prazo)), criadoEm: dataLegis(v(l, i.criado)), conclusao: dataLegis(v(l, i.conclusao)),
      responsaveis: v(l, i.resp).split(',').map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x && !vazio(x)),
    }));
}

/** Nomes de responsáveis que aparecem no arquivo, com quantas tarefas cada um tem. */
export function responsaveisDoArquivo(linhas: LinhaLegis[]): { nome: string; tarefas: number }[] {
  const conta = new Map<string, number>();
  for (const l of linhas) for (const r of l.responsaveis) conta.set(r, (conta.get(r) || 0) + 1);
  return [...conta].map(([nome, tarefas]) => ({ nome, tarefas })).sort((a, b) => b.tarefas - a.tarefas);
}

const semTitulo = (s: string) => normalizar(s).replace(/^(dr|dra|sr|sra)\.?\s+/, '');
/** Sugere a pessoa da equipe para um nome do Legis (nome completo, primeiro nome único ou login como "racostayasminasc"). */
export function sugerirUsuario(nomeLegis: string, usuarios: Usuario[]): string | undefined {
  const equipe = usuarios.filter((u) => u.papel !== 'cliente');
  const n = semTitulo(nomeLegis);
  const exato = equipe.find((u) => semTitulo(u.nome) === n);
  if (exato) return exato.id;
  const tokens = new Set(n.split(/[\s._-]+/).filter((x) => x.length >= 3));
  const login = !/\s/.test(n);
  const candidatos = equipe.filter((u) => {
    const primeiro = semTitulo(u.nome).split(' ')[0];
    return !!primeiro && (tokens.has(primeiro) || (login && primeiro.length >= 4 && n.includes(primeiro)));
  });
  if (candidatos.length === 1) return candidatos[0].id;
  // Vários com o mesmo primeiro nome: desempata pelo sobrenome
  const porSobrenome = candidatos.filter((u) => semTitulo(u.nome).split(' ').slice(1).some((p) => p.length >= 3 && (tokens.has(p) || (login && n.includes(p)))));
  return porSobrenome.length === 1 ? porSobrenome[0].id : undefined;
}

const CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;
const digitos = (s: string) => s.replace(/\D/g, '');
const pareceNome = (s: string) => /^[\p{L}' ]{6,}$/u.test(s.trim()) && s.trim().split(/\s+/).length >= 2;

/** Nomes possíveis do cliente: parte antes do " x " no processo e o final do título. */
export function nomesDoCliente(l: Pick<LinhaLegis, 'titulo' | 'processo'>): string[] {
  const nomes: string[] = [];
  if (l.processo) {
    const autor = l.processo.split(/\s+x\s+/i)[0].replace(/\s*\+\s*\d+\s*$/, '').trim();
    if (pareceNome(autor)) nomes.push(autor);
  }
  const fim = l.titulo.split(/\s+[-–]\s+/).pop() || '';
  if (pareceNome(fim)) nomes.push(fim);
  const depoisParenteses = l.titulo.split(')').pop()?.replace(/^[\s-]+/, '') || '';
  if (pareceNome(depoisParenteses)) nomes.push(depoisParenteses);
  return [...new Set(nomes.map((x) => x.trim()))];
}

/** Processo do RA Connect para a linha: pelo número CNJ no texto ou pelo nome do cliente (se ele tiver um processo só, ou o mais recente). */
export function processoDaLinha(l: LinhaLegis, b: Pick<Banco, 'processos' | 'clientes'>): string | undefined {
  const cnj = `${l.titulo} ${l.processo}`.match(CNJ)?.[0];
  if (cnj) {
    const p = b.processos.find((x) => digitos(x.numero) === digitos(cnj));
    if (p) return p.id;
  }
  for (const nome of nomesDoCliente(l)) {
    const clientes = b.clientes.filter((c) => normalizar(c.nome) === normalizar(nome));
    if (clientes.length !== 1) continue;
    const procs = b.processos.filter((p) => p.clienteId === clientes[0].id);
    if (!procs.length) continue;
    const ultima = (p: (typeof procs)[number]) => [...p.etapas.map((e) => e.data), p.movimentosOficiais?.[0]?.data || ''].sort().pop() || '';
    return [...procs].sort((x, y) => ultima(y).localeCompare(ultima(x)))[0].id;
  }
  return undefined;
}

const COLUNA: Record<string, Tarefa['coluna']> = { pendente: 'afazer', 'em andamento': 'fazendo', concluida: 'concluido', 'em revisao': 'revisao' };
const PONTOS: Record<string, Tarefa['pontos']> = { baixa: 1, media: 2, alta: 3, 'muito alta': 5 };

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export interface PlanoLegis {
  tarefas: Tarefa[];
  novas: number;
  atualizadas: number;
  comProcesso: number;
  semResponsavel: number;
}

/**
 * Monta as tarefas a gravar. `mapa` liga cada nome do Legis a um usuário ('' = ninguém).
 * Tarefas já importadas antes mantêm comentários e histórico.
 */
export function planejarLegis(
  linhas: LinhaLegis[], b: Pick<Banco, 'processos' | 'clientes' | 'tarefas' | 'config'>, mapa: Record<string, string>,
  agora: string, incluirConcluidas = true,
): PlanoLegis {
  const plano: PlanoLegis = { tarefas: [], novas: 0, atualizadas: 0, comProcesso: 0, semResponsavel: 0 };
  const existentes = new Map(b.tarefas.map((t) => [t.id, t]));
  const etiquetasValidas = new Set((b.config.etiquetasTarefa || []).map((e) => e.id));
  const vistas = new Map<string, number>();
  for (const l of linhas) {
    const coluna = COLUNA[normalizar(l.status)] || 'afazer';
    if (!incluirConcluidas && coluna === 'concluido') continue;
    const base = hash(normalizar(`${l.titulo}|${l.criadoEm || ''}|${l.processo}`));
    const n = (vistas.get(base) || 0) + 1;
    vistas.set(base, n);
    const id = `legis-${base}${n > 1 ? `-${n}` : ''}`;

    const pessoas = [...new Set(l.responsaveis.map((r) => mapa[r]).filter(Boolean))];
    const processoId = processoDaLinha(l, b) || null;
    const etiquetas = [
      /prazo/i.test(l.tipo) && 'ett-prazo', /audi[eê]ncia/i.test(l.tipo) && 'ett-audiencia', /alta|urgente/i.test(l.prioridade) && 'ett-urgente',
    ].filter((e): e is string => !!e && etiquetasValidas.has(e));
    const notas = [
      'Importada do Legis.',
      l.responsaveis.length ? `Responsáveis no Legis: ${l.responsaveis.join(', ')}.` : '',
      l.processo && !processoId ? `Processo no Legis: ${l.processo}.` : '',
    ].filter(Boolean).join('\n');

    const antiga = existentes.get(id);
    const t: Tarefa = {
      ...(antiga || {}),
      id, titulo: l.titulo, coluna, pontos: PONTOS[normalizar(l.complexidade)] || 2,
      responsavelId: pessoas[0] || '', participantes: pessoas.slice(1),
      prazo: l.prazo || null, concluidaEm: coluna === 'concluido' ? l.conclusao || l.prazo || l.criadoEm || null : null,
      processoId: processoId || antiga?.processoId || null,
      etiquetas: [...new Set([...(antiga?.etiquetas || []), ...etiquetas])],
      descricao: antiga?.descricao && !antiga.descricao.startsWith('Importada do Legis.') ? antiga.descricao : notas,
      criadaEm: antiga?.criadaEm || (l.criadoEm ? `${l.criadoEm}T12:00:00.000Z` : agora),
      origem: 'legis', importadaLegisEm: agora,
    };
    if (antiga) plano.atualizadas++; else plano.novas++;
    if (t.processoId) plano.comProcesso++;
    if (!t.responsavelId) plano.semResponsavel++;
    plano.tarefas.push(t);
  }
  return plano;
}
