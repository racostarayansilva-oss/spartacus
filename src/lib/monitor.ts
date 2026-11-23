// Regras do monitor automático de processos (DJEN + DataJud), sem acesso a rede ou banco.
// O servidor (server/monitor) busca os dados, aplica estas funções e grava o resultado.
import type { Banco, Cliente, Intimacao, Notificacao, Processo } from '../store.js';
import { agruparPorProcesso, ComunicacaoDjen, montarImportacao } from './importacao.js';
import { somenteDigitos } from './cpf.js';
import { idIntimacaoDjen, intimacaoDaComunicacao } from './intimacoes.js';

export interface MovimentoOficial { data: string; nome: string; complemento?: string }
export interface Aviso { processoId: string; titulo: string; texto: string; relevante: boolean }

/** Identidade de um andamento: evita avisar duas vezes o mesmo movimento. */
export const chaveMovimento = (m: MovimentoOficial) => `${m.data}|${m.nome}|${m.complemento || ''}`;
/** Andamentos que pedem atenção (e, com o certificado, a cópia da peça). */
export const RELEVANTE = /senten|decis|despacho|julg|homolog|ac[oó]rd|tutela|liminar|tr[aâ]nsito|rpv|precat|requisi[cç]/i;
const maisRecentes = (a: MovimentoOficial, b: MovimentoOficial) => String(b.data).localeCompare(String(a.data));

export interface ResultadoDjen {
  intimacoes: Intimacao[];
  processosAlterados: Processo[];
  processosNovos: Processo[];
  clientesNovos: Cliente[];
  avisos: Aviso[];
}

/** Comunicações do DJEN → intimações novas, andamento no processo e cadastro dos processos que ainda não existem. */
export function aplicarComunicacoes(
  estado: { processos: Processo[]; clientes: Cliente[]; intimacoesIds: Set<string> },
  comunicacoes: ComunicacaoDjen[],
  novoId: () => string,
): ResultadoDjen {
  const r: ResultadoDjen = { intimacoes: [], processosAlterados: [], processosNovos: [], clientesNovos: [], avisos: [] };
  const vistas = new Set(estado.intimacoesIds);
  const novas = comunicacoes.filter((c) => {
    const id = idIntimacaoDjen(c);
    if (vistas.has(id)) return false;
    vistas.add(id);
    return true;
  });
  const porDigitos = new Map(estado.processos.map((p) => [somenteDigitos(p.numero), p]));
  const alterados = new Map<string, Processo>();

  const imp = montarImportacao(
    agruparPorProcesso(novas.filter((c) => !porDigitos.has(somenteDigitos(c.processo)))),
    { processos: estado.processos, clientes: estado.clientes } as Banco, novoId, '', 20, false,
  );
  r.processosNovos = imp.processos;
  r.clientesNovos = imp.clientesNovos;
  const nomes = new Map([...estado.clientes, ...imp.clientesNovos].map((c) => [c.id, c.nome]));

  for (const c of novas) {
    r.intimacoes.push(intimacaoDaComunicacao(c));
    const p = porDigitos.get(somenteDigitos(c.processo));
    if (!p) continue;
    const copia = alterados.get(p.id) || structuredClone(p);
    const mov: MovimentoOficial = { data: c.disponibilizacao, nome: `${c.tipo || 'Comunicação'} no DJEN — ${c.tribunal}`, complemento: c.texto.slice(0, 400) };
    if (!(copia.movimentosOficiais || []).some((m) => chaveMovimento(m) === chaveMovimento(mov))) {
      copia.movimentosOficiais = [mov, ...(copia.movimentosOficiais || [])].sort(maisRecentes);
    }
    alterados.set(p.id, copia);
    r.avisos.push({ processoId: p.id, titulo: `Intimação: ${nomes.get(p.clienteId) || p.numero}`, texto: `${c.tipo || 'Comunicação'} — ${c.texto.slice(0, 180)}`, relevante: true });
  }
  for (const p of imp.processos) {
    r.avisos.push({ processoId: p.id, titulo: `Processo novo pelo DJEN: ${nomes.get(p.clienteId) || p.numero}`, texto: `${p.numero} — ${p.assunto}`, relevante: false });
  }
  r.processosAlterados = [...alterados.values()];
  return r;
}

export interface CapaDataJud {
  movimentos: MovimentoOficial[]; classe?: string; assuntos?: string[]; orgaoJulgador?: string;
  tribunal?: string; grau?: string; dataAjuizamento?: string; valorCausa?: number;
}

/**
 * Junta o retorno do DataJud ao processo (mantém as comunicações do DJEN já gravadas).
 * Na primeira consulta não há "novos": é só a carga do histórico.
 */
export function aplicarDataJud(p: Processo, r: CapaDataJud, agora: string): { processo: Processo; novos: MovimentoOficial[]; mudou: boolean } {
  const copia = structuredClone(p);
  const atuais = p.movimentosOficiais || [];
  const djen = atuais.filter((m) => / no DJEN/.test(m.nome));
  const antes = new Set(atuais.map(chaveMovimento));
  const novos = p.atualizadoDataJud ? r.movimentos.filter((m) => !antes.has(chaveMovimento(m))) : [];
  copia.movimentosOficiais = [...djen, ...r.movimentos].sort(maisRecentes);
  copia.atualizadoDataJud = agora;
  copia.dadosJudiciais = {
    classe: r.classe, assuntos: r.assuntos || [], orgao: r.orgaoJulgador, tribunal: r.tribunal, grau: r.grau,
    ajuizamento: r.dataAjuizamento ? String(r.dataAjuizamento).replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3') : undefined,
    atualizadoEm: agora,
  };
  // Valor da causa: só quando o tribunal manda ao DataJud e o processo ainda não tem valor
  if (r.valorCausa && !copia.valor) copia.valor = r.valorCausa;
  const mudou = !p.atualizadoDataJud || JSON.stringify(atuais.map(chaveMovimento)) !== JSON.stringify(copia.movimentosOficiais.map(chaveMovimento));
  return { processo: copia, novos, mudou };
}

/** Aviso do sistema no sino de uma pessoa. */
export function notificacaoDoAviso(a: Aviso, paraId: string, novoId: () => string, agora: string): Notificacao {
  return {
    id: novoId(), paraId, deId: 'sistema', tipo: 'aviso', tarefaId: '',
    tarefaTitulo: a.titulo.slice(0, 160), trecho: a.texto.slice(0, 300), link: `/processos/${a.processoId}`, em: agora, lida: false,
  };
}

/** Quem recebe: o responsável pelo processo; sem responsável, os administradores. */
export function destinatarios(p: Processo | undefined, administradores: string[]): string[] {
  return p?.responsavelId ? [p.responsavelId] : administradores;
}
