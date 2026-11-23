// Correções de dados que rodam uma única vez por escritório (marcadas em config.migracoes).
// Servem para ajustar os dados que já estão no banco sem precisar mexer no Supabase à mão.
// A primeira prepara o escritório recém-criado (etiquetas iniciais).

import type { Banco } from './store';
import { normalizar } from './lib/importacao';
import { ETIQUETAS_LEGIS, ETIQUETAS_TAREFA } from './lib/dadosIniciais';

type Migracao = { id: string; aplicar: (db: Banco) => void };

export const MIGRACOES: Migracao[] = [
  {
    id: 'spartacus-etiquetas-iniciais',
    aplicar: (db) => {
      const juntar = <T extends { nome: string }>(atuais: T[], novas: T[]) => {
        const nomes = new Set(atuais.map((e) => normalizar(e.nome)));
        return [...atuais, ...novas.filter((e) => !nomes.has(normalizar(e.nome)))];
      };
      db.config.etiquetas = juntar(db.config.etiquetas || [], ETIQUETAS_LEGIS);
      db.config.etiquetasTarefa = juntar(db.config.etiquetasTarefa || [], ETIQUETAS_TAREFA);
    },
  },
];

/** Quais correções ainda faltam aplicar neste banco. */
export function migracoesPendentes(b: Banco): Migracao[] {
  const feitas = new Set(b.config.migracoes || []);
  return MIGRACOES.filter((m) => !feitas.has(m.id));
}

/** Aplica as pendentes numa cópia do banco (dentro de alterar) e marca como feitas. */
export function aplicarMigracoes(db: Banco) {
  for (const m of migracoesPendentes(db)) {
    m.aplicar(db);
    db.config.migracoes = [...(db.config.migracoes || []), m.id];
  }
}
