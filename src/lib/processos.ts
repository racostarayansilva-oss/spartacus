// Regras de edição e exclusão de processos (puras, para poder testar sem a tela).

import type { Banco } from '../store';
import { EtapaRegistrada, ETAPA_PARA_REGISTRO } from './etapas';
import { MARCA_AUTOMATICA } from './fases';

const SEPARADOR_CONTRA = ' — contra ';

/** Separa o assunto gravado ("Classe — contra Parte") em classe e parte contrária. */
export function partesDoAssunto(assunto: string): { classe: string; contra: string } {
  const i = (assunto || '').lastIndexOf(SEPARADOR_CONTRA);
  return i >= 0
    ? { classe: assunto.slice(0, i), contra: assunto.slice(i + SEPARADOR_CONTRA.length) }
    : { classe: assunto || '', contra: '' };
}

/** Monta o assunto no formato gravado: "Classe — contra Parte". */
export function montarAssunto(classe: string, contra: string): string {
  const c = classe.trim();
  const x = contra.trim();
  if (!x) return c;
  return c ? `${c}${SEPARADOR_CONTRA}${x}` : `contra ${x}`;
}

export interface VinculosProcesso {
  audiencias: number;
  compromissos: number;
  tarefas: number;
  registros: number;
  lancamentos: number;
}

/** O que está ligado ao processo (mostrado antes de excluir). */
export function vinculosDoProcesso(b: Banco, id: string): VinculosProcesso {
  return {
    audiencias: b.audiencias.filter((a) => a.processoId === id).length,
    compromissos: b.compromissos.filter((c) => c.processoId === id).length,
    tarefas: b.tarefas.filter((t) => t.processoId === id).length,
    registros: b.registros.filter((r) => r.processoId === id).length,
    lancamentos: b.lancamentos.filter((l) => l.processoId === id).length,
  };
}

/**
 * Exclui o processo. As audiências dele também saem (não existem sem processo).
 * Prazos, tarefas, produção do Painel e lançamentos ficam, só perdem a ligação,
 * para não sumir histórico nem dinheiro. O cliente não é apagado.
 */
export function excluirProcesso(db: Banco, id: string) {
  db.processos = db.processos.filter((p) => p.id !== id);
  db.audiencias = db.audiencias.filter((a) => a.processoId !== id);
  for (const lista of [db.compromissos, db.tarefas, db.registros, db.lancamentos]) {
    for (const x of lista as { processoId?: string | null }[]) if (x.processoId === id) x.processoId = null;
  }
}

/** Registro do Painel criado junto com a etapa (ver ETAPA_PARA_REGISTRO). */
function indiceRegistroDaEtapa(db: Banco, processoId: string, e: EtapaRegistrada): number {
  const tipo = ETAPA_PARA_REGISTRO[e.etapa];
  if (!tipo) return -1;
  return db.registros.findIndex((r) => r.processoId === processoId && r.tipo === tipo && r.data === e.data && r.descricao === e.etapa);
}

function criarRegistroDaEtapa(db: Banco, processoId: string, e: EtapaRegistrada, usuarioId: string, novoId: () => string) {
  const tipo = ETAPA_PARA_REGISTRO[e.etapa];
  if (!tipo) return;
  db.registros.push({
    id: novoId(), data: e.data, tipo, usuarioId, processoId,
    resultado: tipo === 'sentenca' ? (e.resultado as 'procedente' | 'parcial' | 'improcedente') : undefined,
    descricao: e.etapa,
  });
}

/** Registra uma etapa e, se for o caso, a produção correspondente no Painel. */
export function registrarEtapa(db: Banco, processoId: string, e: EtapaRegistrada, usuarioId: string, novoId: () => string) {
  const p = db.processos.find((x) => x.id === processoId);
  if (!p) return;
  p.etapas.push(e);
  criarRegistroDaEtapa(db, processoId, e, usuarioId, novoId);
}

/** Remove a etapa (pela posição em p.etapas) e a produção que ela gerou no Painel. */
export function removerEtapa(db: Banco, processoId: string, indice: number) {
  const p = db.processos.find((x) => x.id === processoId);
  const e = p?.etapas[indice];
  if (!p || !e) return;
  p.etapas.splice(indice, 1);
  // Etapa que veio da leitura automática e foi removida: não sugerir de novo
  if ((e.obs || '').startsWith(MARCA_AUTOMATICA)) p.etapasIgnoradas = [...new Set([...(p.etapasIgnoradas || []), e.etapa])];
  const r = indiceRegistroDaEtapa(db, processoId, e);
  if (r >= 0) db.registros.splice(r, 1);
}

/** Corrige uma etapa e mantém o Painel coerente (troca a produção antiga pela nova). */
export function editarEtapa(db: Banco, processoId: string, indice: number, nova: EtapaRegistrada, usuarioId: string, novoId: () => string) {
  const p = db.processos.find((x) => x.id === processoId);
  const antiga = p?.etapas[indice];
  if (!p || !antiga) return;
  const r = indiceRegistroDaEtapa(db, processoId, antiga);
  // Mantém quem lançou originalmente
  const autor = r >= 0 ? db.registros[r].usuarioId : usuarioId;
  if (r >= 0) db.registros.splice(r, 1);
  const limpa: EtapaRegistrada = {
    etapa: nova.etapa,
    data: nova.data,
    obs: nova.obs?.trim() || undefined,
    resultado: nova.etapa === 'Sentença' ? nova.resultado : undefined,
  };
  p.etapas[indice] = limpa;
  criarRegistroDaEtapa(db, processoId, limpa, autor, novoId);
}
