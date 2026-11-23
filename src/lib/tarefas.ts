// Regras das tarefas: colunas do quadro, mover entre colunas, datas, resumo e desempenho.
// O quadro é uma visão calculada: o que fica gravado é a situação (coluna) e o prazo da tarefa.
//
// Colunas do quadro (cada tarefa aparece em uma só):
//   Todas as tarefas: pendentes sem prazo ou com prazo depois dos próximos 7 dias
//   Hoje:             pendentes com prazo hoje ou atrasadas
//   Próximos dias:    pendentes com prazo de amanhã até 7 dias
//   Fazendo:          em andamento (inclui as que estão em revisão)
//   Concluídas hoje:  concluídas hoje (as mais antigas ficam na Lista e no Desempenho)

import type { Tarefa } from '../store';
import { DataISO, diasEntre, hoje as hojeLocal, iso, somarDias } from './datas';

export type ColunaQuadro = 'todas' | 'hoje' | 'proximos' | 'fazendo' | 'concluidas';

export const PROXIMOS_DIAS = 7;

export const COLUNAS_QUADRO: { id: ColunaQuadro; titulo: string; cor: string; dica: string }[] = [
  { id: 'todas', titulo: 'Todas as tarefas', cor: 'var(--vermelho)', dica: `Pendentes sem prazo ou com prazo depois de ${PROXIMOS_DIAS} dias` },
  { id: 'hoje', titulo: 'Hoje', cor: 'var(--texto-3)', dica: 'Prazo hoje e atrasadas' },
  { id: 'proximos', titulo: 'Próximos dias', cor: 'var(--info)', dica: `Prazo nos próximos ${PROXIMOS_DIAS} dias` },
  { id: 'fazendo', titulo: 'Fazendo', cor: 'var(--primario)', dica: 'Em andamento ou em revisão' },
  { id: 'concluidas', titulo: 'Concluídas hoje', cor: 'var(--verde)', dica: 'Finalizadas hoje' },
];

export const ROTULO_SITUACAO: Record<Tarefa['coluna'], string> = {
  afazer: 'A fazer',
  fazendo: 'Fazendo',
  revisao: 'Em revisão',
  concluido: 'Concluída',
};

export const PONTOS: Tarefa['pontos'][] = [1, 2, 3, 5, 8];
export const ROTULO_PONTOS: Record<Tarefa['pontos'], string> = { 1: 'muito simples', 2: 'simples', 3: 'média', 5: 'complexa', 8: 'muito complexa' };

/** Em qual coluna do quadro a tarefa aparece (null = concluída antes de hoje, não aparece no quadro). */
export function colunaDoQuadro(t: Tarefa, hoje: DataISO): ColunaQuadro | null {
  if (t.coluna === 'concluido') return t.concluidaEm === hoje ? 'concluidas' : null;
  if (t.coluna === 'fazendo' || t.coluna === 'revisao') return 'fazendo';
  if (t.prazo && t.prazo <= hoje) return 'hoje';
  if (t.prazo && t.prazo <= somarDias(hoje, PROXIMOS_DIAS)) return 'proximos';
  return 'todas';
}

export const atrasada = (t: Tarefa, hoje: DataISO) => t.coluna !== 'concluido' && !!t.prazo && t.prazo < hoje;

/** Pessoas na tarefa: o responsável principal primeiro, depois os demais. */
export function envolvidos(t: Tarefa): string[] {
  return [...new Set([t.responsavelId, ...(t.participantes || [])].filter(Boolean))];
}

export const envolve = (t: Tarefa, usuarioId: string) => envolvidos(t).includes(usuarioId);

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "15 ago 2026" */
export function dataCurta(d: DataISO): string {
  const [a, m, dia] = d.split('-');
  return `${Number(dia)} ${MESES[Number(m) - 1]} ${a}`;
}

/** Texto da data no cartão: "Hoje", "Amanhã", "Ontem", "Há 3 dias" ou "15 ago 2026 10:00". */
export function rotuloPrazo(prazo: DataISO, hora: string | null | undefined, hoje: DataISO): string {
  const d = diasEntre(hoje, prazo);
  const h = hora ? ` ${hora}` : '';
  if (d === 0) return `Hoje${h}`;
  if (d === 1) return `Amanhã${h}`;
  if (d === -1) return `Ontem${h}`;
  if (d < -1 && d >= -30) return `Há ${-d} dias`;
  return `${dataCurta(prazo)}${h}`;
}

export interface EntradaHistorico { em: string; usuarioId: string; texto: string }

export function anotar(t: Tarefa, usuarioId: string, texto: string, agora: string) {
  t.historico = [...(t.historico || []), { em: agora, usuarioId, texto }];
}

/** Muda a situação, cuidando da data de conclusão e do histórico. */
export function mudarSituacao(t: Tarefa, coluna: Tarefa['coluna'], usuarioId: string, agora: string, dia: DataISO = hojeLocal()) {
  if (t.coluna === coluna) return;
  const antes = t.coluna;
  t.coluna = coluna;
  t.concluidaEm = coluna === 'concluido' ? dia : null;
  anotar(t, usuarioId, coluna === 'concluido' ? 'Concluiu a tarefa' : antes === 'concluido' ? `Reabriu a tarefa (${ROTULO_SITUACAO[coluna]})` : `Mudou para ${ROTULO_SITUACAO[coluna]}`, agora);
}

function mudarPrazo(t: Tarefa, prazo: DataISO | null, usuarioId: string, agora: string) {
  if ((t.prazo || null) === prazo) return;
  t.prazo = prazo;
  anotar(t, usuarioId, prazo ? `Prazo alterado para ${dataCurta(prazo)}` : 'Prazo removido', agora);
}

/**
 * Arrastar o cartão para uma coluna do quadro:
 *  - Todas: volta para "a fazer"; se o prazo a colocaria em Hoje/Próximos, tira o prazo.
 *  - Hoje: "a fazer" com prazo hoje (mantém se já estava atrasada ou hoje).
 *  - Próximos dias: "a fazer" com prazo amanhã (mantém se já estava nessa janela).
 *  - Fazendo: em andamento.  - Concluídas hoje: concluída.
 */
export function moverNoQuadro(t: Tarefa, destino: ColunaQuadro, hoje: DataISO, usuarioId: string, agora: string) {
  if (destino === 'fazendo') return mudarSituacao(t, t.coluna === 'revisao' ? 'revisao' : 'fazendo', usuarioId, agora, hoje);
  if (destino === 'concluidas') return mudarSituacao(t, 'concluido', usuarioId, agora, hoje);
  mudarSituacao(t, 'afazer', usuarioId, agora, hoje);
  const limite = somarDias(hoje, PROXIMOS_DIAS);
  if (destino === 'hoje' && !(t.prazo && t.prazo <= hoje)) mudarPrazo(t, hoje, usuarioId, agora);
  if (destino === 'proximos' && !(t.prazo && t.prazo > hoje && t.prazo <= limite)) mudarPrazo(t, somarDias(hoje, 1), usuarioId, agora);
  if (destino === 'todas' && t.prazo && t.prazo <= limite) mudarPrazo(t, null, usuarioId, agora);
}

export interface FiltroTarefas {
  busca?: string;
  /** '' = todos; 'eu' = tarefas em que o usuário atual está; ou id de uma pessoa */
  pessoa?: string;
  etiqueta?: string;
  usuarioAtualId?: string;
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Filtra pela busca (título, descrição, cliente, número do processo), pessoa e etiqueta. */
export function filtrarTarefas(lista: Tarefa[], f: FiltroTarefas, textoExtra: (t: Tarefa) => string = () => ''): Tarefa[] {
  const busca = norm(f.busca || '').trim();
  const pessoa = f.pessoa === 'eu' ? f.usuarioAtualId || '' : f.pessoa || '';
  return lista.filter((t) =>
    (!pessoa || envolve(t, pessoa)) &&
    (!f.etiqueta || (t.etiquetas || []).includes(f.etiqueta)) &&
    (!busca || norm(`${t.titulo} ${t.descricao || ''} ${textoExtra(t)}`).includes(busca)),
  );
}

export const inicioDoMes = (hoje: DataISO) => `${hoje.slice(0, 7)}-01`;

/** Números do topo: finalizadas no mês, pendentes e pontos feitos no mês. */
export function resumoTarefas(lista: Tarefa[], hoje: DataISO) {
  const mes = inicioDoMes(hoje);
  const finalizadas = lista.filter((t) => t.coluna === 'concluido' && (t.concluidaEm || '') >= mes);
  const pendentes = lista.filter((t) => t.coluna !== 'concluido');
  return {
    finalizadas: finalizadas.length,
    pendentes: pendentes.length,
    pontos: finalizadas.reduce((s, t) => s + t.pontos, 0),
    atrasadas: pendentes.filter((t) => atrasada(t, hoje)).length,
    hoje: pendentes.filter((t) => t.prazo === hoje).length,
    fazendo: pendentes.filter((t) => t.coluna === 'fazendo' || t.coluna === 'revisao').length,
  };
}

/** Placar por pessoa no período (pontos e tarefas contam para o responsável principal). */
export function desempenho(lista: Tarefa[], pessoas: { id: string; nome: string }[], desde: DataISO, hoje: DataISO) {
  return pessoas
    .map((u) => {
      const minhas = lista.filter((t) => t.responsavelId === u.id);
      const feitas = minhas.filter((t) => t.coluna === 'concluido' && (t.concluidaEm || '') >= desde);
      const abertas = minhas.filter((t) => t.coluna !== 'concluido');
      const noPrazo = feitas.filter((t) => !t.prazo || (t.concluidaEm || '') <= t.prazo).length;
      return {
        u,
        pontos: feitas.reduce((s, t) => s + t.pontos, 0),
        concluidas: feitas.length,
        noPrazo: feitas.length ? Math.round((noPrazo / feitas.length) * 100) : null,
        abertas: abertas.length,
        pontosAbertos: abertas.reduce((s, t) => s + t.pontos, 0),
        atrasadas: abertas.filter((t) => atrasada(t, hoje)).length,
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.concluidas - a.concluidas || a.atrasadas - b.atrasadas);
}

/** Tarefa criada ao gerar o prazo de uma intimação na Controladoria. */
export function tarefaDaIntimacao(
  i: { id: string; processoNumero: string; tribunal: string; texto: string },
  o: { id: string; dias: number; fatal: DataISO; responsavelId: string; processoId: string | null; nomeCliente?: string; etiquetaPrazo?: string; usuarioId: string; agora: string },
): Tarefa {
  const quem = o.nomeCliente && o.nomeCliente !== '—' ? o.nomeCliente : i.processoNumero;
  const t: Tarefa = {
    id: o.id,
    titulo: `Cumprir prazo de ${o.dias} dias — ${quem}`,
    descricao: `${i.tribunal} · ${i.processoNumero}\n\n${i.texto.slice(0, 600)}${i.texto.length > 600 ? '…' : ''}`,
    responsavelId: o.responsavelId,
    pontos: 3,
    coluna: 'afazer',
    processoId: o.processoId,
    prazo: o.fatal,
    etiquetas: o.etiquetaPrazo ? [o.etiquetaPrazo] : [],
    origem: 'intimacao',
    intimacaoId: i.id,
    criadaEm: o.agora,
    criadaPor: o.usuarioId,
    historico: [],
  };
  anotar(t, o.usuarioId, 'Criou a tarefa a partir de uma intimação', o.agora);
  return t;
}

/** Ordem dentro de uma coluna: atrasadas e prazos mais próximos primeiro, depois as sem prazo. */
export function ordenarParaQuadro(a: Tarefa, b: Tarefa): number {
  const pa = a.prazo ? `${a.prazo} ${a.hora || '99:99'}` : '9999';
  const pb = b.prazo ? `${b.prazo} ${b.hora || '99:99'}` : '9999';
  return pa.localeCompare(pb) || b.pontos - a.pontos || a.titulo.localeCompare(b.titulo);
}

/** Data e hora no fuso do computador: "9 nov 2026 14:30" (o instante é gravado em UTC). */
export function quandoLocal(instante: string): string {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return instante;
  const dia = iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  return `${dataCurta(dia)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
