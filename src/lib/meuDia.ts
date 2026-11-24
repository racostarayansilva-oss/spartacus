// "Meu dia" da Área de trabalho: prazos, atividades e audiências de uma pessoa (ou da equipe),
// separados em atrasados, hoje e próximos dias.
import type { Banco } from '../store';
import { DataISO, somarDias } from './datas';

export type TipoItemDia = 'prazo' | 'atividade' | 'audiencia';
export interface ItemDia {
  tipo: TipoItemDia; id: string; titulo: string; data: DataISO; hora?: string;
  detalhe?: string; rota: string; responsavelId?: string;
}
export interface MeuDia { atrasados: ItemDia[]; hoje: ItemDia[]; proximos: ItemDia[] }

export function montarMeuDia(b: Pick<Banco, 'compromissos' | 'tarefas' | 'audiencias' | 'processos' | 'clientes'>, hoje: DataISO, quem: string | null, dias = 7): MeuDia {
  const ate = somarDias(hoje, dias);
  const nomeCliente = new Map(b.clientes.map((c) => [c.id, c.nome]));
  const proc = new Map(b.processos.map((p) => [p.id, p]));
  const doProcesso = (id?: string | null) => {
    const p = id ? proc.get(id) : undefined;
    return p ? nomeCliente.get(p.clienteId) || p.numero : undefined;
  };
  const meu = (ids: (string | undefined)[]) => !quem || ids.includes(quem);
  const itens: ItemDia[] = [];

  for (const c of b.compromissos) {
    if (c.status !== 'pendente' || c.data > ate || !meu([c.responsavelId])) continue;
    itens.push({ tipo: 'prazo', id: c.id, titulo: c.titulo, data: c.data, detalhe: doProcesso(c.processoId), rota: c.processoId ? `/processos/${c.processoId}` : '/agenda', responsavelId: c.responsavelId });
  }
  for (const t of b.tarefas) {
    if (t.coluna === 'concluido' || !t.prazo || t.prazo > ate || !meu([t.responsavelId, ...(t.participantes || [])])) continue;
    itens.push({ tipo: 'atividade', id: t.id, titulo: t.titulo, data: t.prazo, detalhe: doProcesso(t.processoId), rota: `/tarefas?tarefa=${t.id}`, responsavelId: t.responsavelId });
  }
  for (const a of b.audiencias) {
    // Audiência passada não é "atrasada": só entram as de hoje em diante
    if (a.data < hoje || a.data > ate) continue;
    const p = proc.get(a.processoId);
    if (quem && p && p.responsavelId && p.responsavelId !== quem) continue;
    itens.push({ tipo: 'audiencia', id: a.id, titulo: `Audiência${a.local ? ` — ${a.local}` : ''}`, data: a.data, hora: a.hora, detalhe: doProcesso(a.processoId), rota: `/processos/${a.processoId}`, responsavelId: p?.responsavelId });
  }

  const ordem = (x: ItemDia, y: ItemDia) => x.data.localeCompare(y.data) || (x.hora || '99').localeCompare(y.hora || '99') || x.titulo.localeCompare(y.titulo);
  itens.sort(ordem);
  return {
    atrasados: itens.filter((i) => i.data < hoje),
    hoje: itens.filter((i) => i.data === hoje),
    proximos: itens.filter((i) => i.data > hoje),
  };
}
