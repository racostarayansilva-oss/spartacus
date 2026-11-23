// Central de notificações: avisa quem foi colocado numa tarefa (criada ou alterada) e quem foi
// mencionado com @ na descrição ou num comentário. As notificações nascem em store.alterar,
// comparando as tarefas antes e depois de cada alteração, então valem para qualquer tela que crie tarefa.
import type { Notificacao, Tarefa, Usuario } from '../store.js';

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** "Dr. Rômulo Alves Costa" → "Rômulo"; "Ana (Controladoria)" → "Ana" */
export const primeiroNome = (nome: string) => nome.split(/\s+/).find((p) => !/^(dr|dra|sr|sra)\.?$/i.test(p)) ?? nome;

/** Formas aceitas de mencionar cada pessoa: o nome completo e, se ninguém mais tiver o mesmo, o primeiro nome. */
function formas(usuarios: Usuario[]): { id: string; forma: string }[] {
  const contagem = new Map<string, number>();
  usuarios.forEach((u) => { const p = norm(primeiroNome(u.nome)); contagem.set(p, (contagem.get(p) || 0) + 1); });
  const lista: { id: string; forma: string }[] = [];
  for (const u of usuarios) {
    lista.push({ id: u.id, forma: norm(u.nome) });
    const p = norm(primeiroNome(u.nome));
    if (contagem.get(p) === 1) lista.push({ id: u.id, forma: p });
  }
  // As mais longas primeiro: "@ana paula" ganha de "@ana"
  return lista.sort((a, b) => b.forma.length - a.forma.length);
}

/** Trechos do texto com as menções marcadas (para mostrar em destaque e para descobrir quem foi mencionado). */
export function partesComMencao(original: string, usuarios: Usuario[]): { texto: string; usuarioId?: string }[] {
  const equipe = usuarios.filter((u) => u.papel !== 'cliente');
  if (!original.includes('@') || !equipe.length) return [{ texto: original }];
  const fs = formas(equipe);
  // Compara letra a letra numa cópia sem acento e minúscula, do mesmo tamanho do texto
  const chars = Array.from(original.normalize('NFC'));
  const semAcento = chars.map((c) => norm(c).slice(0, 1) || c);
  const partes: { texto: string; usuarioId?: string }[] = [];
  let atual = '';
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === '@' && (i === 0 || !/[\p{L}\p{N}]/u.test(chars[i - 1]))) {
      const achou = fs.find(({ forma }) => {
        const trecho = semAcento.slice(i + 1, i + 1 + forma.length).join('');
        const depois = chars[i + 1 + forma.length];
        return trecho === forma && (depois === undefined || !/[\p{L}\p{N}]/u.test(depois));
      });
      if (achou) {
        if (atual) partes.push({ texto: atual });
        atual = '';
        partes.push({ texto: chars.slice(i, i + 1 + achou.forma.length).join(''), usuarioId: achou.id });
        i += 1 + achou.forma.length;
        continue;
      }
    }
    atual += chars[i];
    i++;
  }
  if (atual) partes.push({ texto: atual });
  return partes;
}

export function mencionados(texto: string | undefined, usuarios: Usuario[]): string[] {
  if (!texto) return [];
  return [...new Set(partesComMencao(texto, usuarios).map((p) => p.usuarioId).filter(Boolean) as string[])];
}

const pessoas = (t: Tarefa) => [...new Set([t.responsavelId, ...(t.participantes || [])].filter(Boolean))];
const trecho = (s: string) => (s.length > 140 ? s.slice(0, 137).trimEnd() + '…' : s);

/** Notificações geradas por uma alteração nas tarefas. Quem fez a alteração nunca é avisado de si mesmo. */
export function derivarNotificacoes(
  antes: Tarefa[], depois: Tarefa[], usuarios: Usuario[], autorId: string, agora: string, novoId: () => string,
): Notificacao[] {
  const anteriores = new Map(antes.map((t) => [t.id, t]));
  const novas: Notificacao[] = [];
  const avisar = (paraId: string, tipo: Notificacao['tipo'], t: Tarefa, deId: string, extra: Partial<Notificacao> = {}) => {
    if (!paraId || paraId === deId) return;
    if (!usuarios.some((u) => u.id === paraId && u.papel !== 'cliente')) return;
    novas.push({ id: novoId(), paraId, deId, tipo, tarefaId: t.id, tarefaTitulo: t.titulo, em: agora, lida: false, ...extra });
  };

  for (const t of depois) {
    const a = anteriores.get(t.id);
    // Importação do Legis (centenas de tarefas de uma vez): não avisa ninguém
    if (t.importadaLegisEm && t.importadaLegisEm !== a?.importadaLegisEm) continue;
    if (!a) {
      const avisados = new Set<string>();
      for (const p of pessoas(t)) { avisar(p, 'tarefa_criada', t, autorId); avisados.add(p); }
      for (const m of mencionados(t.descricao, usuarios)) if (!avisados.has(m)) avisar(m, 'mencao', t, autorId, { trecho: trecho(t.descricao!) });
      for (const c of t.comentarios || []) for (const m of mencionados(c.texto, usuarios)) avisar(m, 'mencao', t, c.usuarioId, { trecho: trecho(c.texto), comentarioId: c.id });
      continue;
    }
    // Pessoas que entraram agora na tarefa
    const antigas = new Set(pessoas(a));
    const entraram = pessoas(t).filter((p) => !antigas.has(p));
    entraram.forEach((p) => avisar(p, 'tarefa_atribuida', t, autorId));
    // Menções novas na descrição
    if ((a.descricao || '') !== (t.descricao || '')) {
      const ja = new Set([...mencionados(a.descricao, usuarios), ...entraram]);
      for (const m of mencionados(t.descricao, usuarios)) if (!ja.has(m)) avisar(m, 'mencao', t, autorId, { trecho: trecho(t.descricao!) });
    }
    // Comentários novos
    if ((t.comentarios || []).length) {
      const vistos = new Set((a.comentarios || []).map((c) => c.id));
      for (const c of t.comentarios!) {
        if (vistos.has(c.id)) continue;
        for (const m of mencionados(c.texto, usuarios)) avisar(m, 'mencao', t, c.usuarioId, { trecho: trecho(c.texto), comentarioId: c.id });
      }
    }
  }
  return novas;
}

/** Verificação barata: só vale comparar quando algo que gera aviso mudou. */
export function tarefasMudaramPessoas(antes: Tarefa[], depois: Tarefa[]): boolean {
  if (antes.length !== depois.length) return true;
  const mapa = new Map(antes.map((t) => [t.id, t]));
  return depois.some((t) => {
    const a = mapa.get(t.id);
    return !a || a.responsavelId !== t.responsavelId || (a.participantes || []).join() !== (t.participantes || []).join()
      || (a.descricao || '') !== (t.descricao || '') || (a.comentarios || []).length !== (t.comentarios || []).length;
  });
}

export const TEXTO_TIPO: Record<Notificacao['tipo'], string> = {
  tarefa_criada: 'criou uma tarefa para você',
  tarefa_atribuida: 'colocou você na tarefa',
  mencao: 'mencionou você em',
  aviso: '',
};
