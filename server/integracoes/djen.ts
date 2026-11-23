// Comunicações processuais (intimações) do Diário de Justiça Eletrônico Nacional — DJEN / Comunica PJe (CNJ).
// API pública e gratuita, consulta por OAB. Limite: 20 consultas por minuto.
// É a base da Caixa de intimações e da importação de processos pela OAB.

import { ErroApi, buscarJson } from '../http.js';

export interface Comunicacao {
  id: string;
  disponibilizacao: string;
  tribunal: string;
  processo: string;
  orgao?: string;
  tipo?: string;
  classe?: string;
  texto: string;
  link?: string;
  /** Partes intimadas, com o polo (A = ativo, P = passivo) */
  partes: { nome: string; polo: string }[];
  advogados: { nome: string; oab: string }[];
  /** Mantido por compatibilidade com a Controladoria */
  destinatarios?: string[];
}

function validar(oab: string, uf: string) {
  // Mantém a letra da inscrição suplementar (ex.: 30733A)
  const numero = (oab || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^\d+[A-Z]?$/.test(numero)) throw new ErroApi(400, 'Informe o número da OAB.');
  if (!/^[A-Z]{2}$/i.test(uf || '')) throw new ErroApi(400, 'Informe a UF da OAB (ex.: MA).');
  return numero;
}

function converter(i: any): Comunicacao {
  const partes = (i.destinatarios || []).map((d: any) => ({ nome: String(d.nome || '').trim(), polo: String(d.polo || '') })).filter((d: any) => d.nome);
  return {
    id: String(i.id ?? i.hash ?? `${i.numero_processo}-${i.data_disponibilizacao}`),
    disponibilizacao: String(i.data_disponibilizacao || i.datadisponibilizacao || '').slice(0, 10),
    tribunal: i.siglaTribunal || i.sigla_tribunal || '',
    processo: i.numeroprocessocommascara || i.numero_processo || '',
    orgao: i.nomeOrgao || i.nome_orgao,
    tipo: i.tipoComunicacao || i.tipo_comunicacao,
    classe: i.nomeClasse,
    texto: String(i.texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    link: i.link,
    partes,
    advogados: (i.destinatarioadvogados || [])
      .map((a: any) => ({ nome: a.advogado?.nome || '', oab: `${a.advogado?.uf_oab || ''} ${a.advogado?.numero_oab || ''}`.trim() }))
      .filter((a: any) => a.nome),
    destinatarios: partes.map((p: any) => p.nome),
  };
}

/** Uma página (até 100 comunicações) e o total do período. */
export async function paginaComunicacoes(oab: string, uf: string, inicio: string, fim: string, pagina = 1): Promise<{ total: number; itens: Comunicacao[] }> {
  const numero = validar(oab, uf);
  const q = new URLSearchParams({
    numeroOab: numero,
    ufOab: uf.toUpperCase(),
    dataDisponibilizacaoInicio: inicio,
    dataDisponibilizacaoFim: fim,
    itensPorPagina: '100',
    pagina: String(Math.max(1, Math.floor(Number(pagina) || 1))),
  });
  const dados = await buscarJson(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${q}`, { timeoutMs: 30_000 });
  const itens: any[] = dados?.items || dados?.itens || [];
  return { total: Number(dados?.count ?? itens.length), itens: itens.map(converter) };
}

/** Todas as comunicações de um período curto (usado pela Controladoria; até 5 páginas). */
export async function comunicacoesPorOab(oab: string, uf: string, inicio: string, fim: string): Promise<Comunicacao[]> {
  const primeira = await paginaComunicacoes(oab, uf, inicio, fim, 1);
  const todas = [...primeira.itens];
  const paginas = Math.min(5, Math.ceil(primeira.total / 100));
  for (let p = 2; p <= paginas; p++) todas.push(...(await paginaComunicacoes(oab, uf, inicio, fim, p)).itens);
  return todas;
}
