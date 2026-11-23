// Catálogo de normas federais (server/dados/normas-federais.json.gz, gerado por scripts/baixar-normas.mjs)
// + detalhe de cada norma pelos Dados Abertos do Senado.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { buscarNormas, FiltrosNorma, indexar, ItemCatalogo, NormaIndexada, referenciaNorma, ROTULO_TIPO_NORMA, TipoNorma } from '../../src/lib/buscaNormas.js';
import { ErroApi, buscarJson } from '../http.js';

let catalogo: { gerado: string; fonte: string; base: NormaIndexada[]; porId: Map<string, ItemCatalogo>; porTipo: Record<string, number> } | null = null;

function carregar() {
  if (catalogo) return catalogo;
  let bruto: Buffer;
  try {
    bruto = readFileSync(join(process.cwd(), 'server', 'dados', 'normas-federais.json.gz'));
  } catch {
    throw new ErroApi(503, 'Catálogo de normas não encontrado. Rode: node scripts/baixar-normas.mjs');
  }
  const d = JSON.parse(gunzipSync(bruto).toString('utf8')) as { gerado: string; fonte: string; itens: ItemCatalogo[] };
  const porTipo: Record<string, number> = {};
  for (const x of d.itens) porTipo[x[1]] = (porTipo[x[1]] || 0) + 1;
  catalogo = { gerado: d.gerado, fonte: d.fonte, base: indexar(d.itens), porId: new Map(d.itens.map((x) => [x[0], x])), porTipo };
  return catalogo;
}

export interface NormaResumo {
  id: string;
  tipo: TipoNorma;
  rotuloTipo: string;
  numero: string;
  data: string;
  nome: string;
  referencia: string;
  ementa: string;
  apelidos: string[];
}

const resumo = (x: ItemCatalogo): NormaResumo => ({
  id: x[0], tipo: x[1], rotuloTipo: ROTULO_TIPO_NORMA[x[1]], numero: x[2], data: x[3], nome: x[4],
  referencia: referenciaNorma(x[1], x[2], x[3], x[4]), ementa: x[5], apelidos: x[6],
});

export function infoCatalogo() {
  const c = carregar();
  return { total: c.base.length, gerado: c.gerado, fonte: c.fonte, porTipo: c.porTipo };
}

export function buscarNoCatalogo(q: string, filtros: FiltrosNorma, pagina: number) {
  const termo = (q || '').trim().slice(0, 200);
  if (!termo && !filtros.tipo) throw new ErroApi(400, 'Digite o que procura (ex.: lei 8.213, CLT, aposentadoria rural).');
  const c = carregar();
  const r = buscarNormas(c.base, termo, filtros, pagina, 20);
  return { total: r.total, pagina, consulta: r.consulta, itens: r.itens.map((i) => resumo(i.item)) };
}

/** Ficha da norma no Senado: URN, publicações e alterações/regulamentações posteriores. */
export async function detalheNorma(id: string) {
  if (!/^\d{1,12}$/.test(id || '')) throw new ErroApi(400, 'Código da norma inválido.');
  const local = carregar().porId.get(id);
  const lista = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
  const d = await buscarJson(`https://legis.senado.leg.br/dadosabertos/legislacao/${id}.json`, { timeoutMs: 30_000 });
  const doc = lista(d?.DetalheDocumento?.documentos?.documento)[0];
  if (!doc && !local) throw new ErroApi(404, 'Norma não encontrada no Senado.');
  const ident = doc?.identificacao || {};
  const url = String(ident.urlDocumento || '');
  const urn = (url.match(/urn=(urn:lex:[^&]+)/) || [])[1] || '';
  const publicacoes = lista(doc?.publicacoes?.publicacao).map((p) => ({ tipo: String(p.tipo || ''), descricao: String(p.dispositivo || p.fonte || '').replace(/\s+/g, ' ').trim(), data: String(p.data || '') }));
  const relacoes = lista(doc?.vides?.vide).map((v) => ({
    id: String(v.codnormaposterior || ''),
    norma: String(v.nomeNormaPosterior || ''),
    data: String(v.datAssinatura || ''),
    relacao: String(v.comentario || '').replace(/^Declaração de\s+/i, '').trim(),
    itens: typeof v.itens === 'string' ? v.itens : '',
  }));
  return {
    ...(local ? resumo(local) : {}),
    id,
    urn,
    normasLeg: url || (urn ? `https://normas.leg.br/?urn=${encodeURIComponent(urn)}` : ''),
    senado: `https://legis.senado.leg.br/norma/${id}`,
    lexml: urn ? `https://www.lexml.gov.br/urn/${urn}` : '',
    publicacoes,
    relacoes,
  };
}
