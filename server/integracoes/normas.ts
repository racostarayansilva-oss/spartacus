// normas.leg.br: texto oficial de dispositivos (formato JSON-LD, licença CC BY 4.0 — citar a fonte).
// - Leis com árvore de dispositivos (ex.: CPC): percorre hasPart; o texto fica em workExample.text
//   e o dispositivo é o sufixo depois de "!" (ex.: art224, art224_par2).
// - Leis sem árvore (ex.: Lei 8.213): baixa a compilação vigente (encoding "Current") em HTML e recorta o artigo.
// Senado/LexML: identificação oficial da norma.

import { ErroApi, buscarJson } from '../http.js';

const BASE = 'https://normas.leg.br/api/public';

function validarUrn(urn: string) {
  if (!/^urn:lex:br:[a-z0-9:;.\-]+$/i.test(urn || '')) throw new ErroApi(400, 'URN LexML inválida (ex.: urn:lex:br:federal:lei:1991-07-24;8213).');
}

const cacheArvore = new Map<string, { em: number; dados: any }>();

async function norma(urn: string): Promise<any> {
  validarUrn(urn);
  const c = cacheArvore.get(urn);
  if (c && Date.now() - c.em < 6 * 3600_000) return c.dados;
  const q = new URLSearchParams({ urn, tipo_documento: 'maior-detalhe' });
  const dados = await buscarJson(`${BASE}/normas?${q}`, { timeoutMs: 45_000 });
  cacheArvore.set(urn, { em: Date.now(), dados });
  return dados;
}

const lista = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);

function idDispositivo(no: any): string | null {
  const id: string = no?.legislationIdentifier || no?.['@id'] || '';
  const i = id.lastIndexOf('!');
  return i >= 0 ? id.slice(i + 1) : null;
}

/** Escolhe a redação vigente quando há várias versões. */
function redacao(no: any): { rotulo: string; texto: string } | null {
  const versoes = lista(no?.workExample).filter((w) => w?.text || w?.name);
  if (!versoes.length) return null;
  const vigente = [...versoes].reverse().find((w) => w.legislationLegalForce !== 'NotInForce') || versoes[versoes.length - 1];
  return { rotulo: String(vigente.name || '').trim(), texto: String(vigente.text || '').replace(/<[^>]+>/g, '').trim() };
}

function percorrer(no: any, visita: (n: any, nivel: number) => void, nivel = 0) {
  if (!no || typeof no !== 'object') return;
  visita(no, nivel);
  for (const f of lista(no.hasPart)) percorrer(f, visita, nivel + 1);
}

export interface TextoDispositivo {
  urn: string;
  dispositivo: string;
  texto: { id: string; texto: string; nivel: number }[];
  fonte: string;
  origem: 'arvore' | 'compilacao';
}

function decodificarEntidades(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª')
    .replace(/&sect;/g, '§');
}

function paragrafosHtml(html: string): string[] {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .split(/<\/(?:p|h[1-6]|td|li|div)>/i)
    .map((p) => decodificarEntidades(p.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean);
}

const CABECALHO = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|Se[çc][ãa]o|Subse[çc][ãa]o)\s/;

/** Recorta um artigo do HTML da compilação (ex.: "art48" → "Art. 48 ..." até o próximo artigo). */
export function recortarArtigo(html: string, art: string): string[] {
  const m = art.match(/^art(\d+)(?:-([a-z]))?/i);
  if (!m) return [];
  const num = m[1];
  const letra = m[2] ? `-${m[2].toUpperCase()}` : '';
  const inicio = new RegExp(`^Art\\.\\s*${num}(?:º|°|o)?${letra.replace('-', '\\s*-\\s*')}(?![\\d-])\\.?\\s`, 'i');
  const qualquerArtigo = /^Art\.\s*\d/i;
  const ps = paragrafosHtml(html);
  const i = ps.findIndex((p) => inicio.test(p + ' '));
  if (i < 0) return [];
  const out = [ps[i]];
  for (let j = i + 1; j < ps.length; j++) {
    if (qualquerArtigo.test(ps[j]) || CABECALHO.test(ps[j])) break;
    out.push(ps[j]);
  }
  return out;
}

/** Texto de um artigo (com parágrafos, incisos e alíneas). */
export async function textoArtigo(urn: string, art: string): Promise<TextoDispositivo> {
  if (!/^art\d+[a-z0-9_\-]*$/i.test(art || '')) throw new ErroApi(400, 'Dispositivo inválido (ex.: art48).');
  const dados = await norma(urn);
  const fonte = `https://normas.leg.br/?urn=${encodeURIComponent(urn)}`;

  let alvo: any = null;
  percorrer(dados, (n) => {
    if (!alvo && idDispositivo(n)?.toLowerCase() === art.toLowerCase()) alvo = n;
  });
  if (alvo) {
    const texto: TextoDispositivo['texto'] = [];
    percorrer(alvo, (n, nivel) => {
      const r = redacao(n);
      if (r && (r.texto || r.rotulo)) texto.push({ id: idDispositivo(n) || '', texto: [r.rotulo, r.texto].filter(Boolean).join(' '), nivel });
    });
    return { urn, dispositivo: art, texto, fonte, origem: 'arvore' };
  }

  // Sem árvore: usa a compilação vigente em HTML.
  const enc = lista(dados?.encoding);
  const atual = enc.find((e) => e.version === 'Current') || enc[enc.length - 1];
  const url = String(atual?.contentUrl || '').replace('https://normas.leg.br/api/binario/', `${BASE}/binario/`);
  if (!url.startsWith(`${BASE}/binario/`)) throw new ErroApi(404, `Dispositivo ${art} não encontrado e a norma não tem texto compilado.`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  let html = '';
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'RA-Connect/0.1' } });
    if (!r.ok) throw new ErroApi(502, `normas.leg.br respondeu ${r.status} ao baixar o texto.`);
    html = new TextDecoder('utf-8').decode(await r.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
  const ps = recortarArtigo(html, art);
  if (!ps.length) throw new ErroApi(404, `Dispositivo ${art} não encontrado no texto compilado.`);
  return {
    urn,
    dispositivo: art,
    texto: ps.map((p, i) => ({ id: i === 0 ? art : '', texto: p, nivel: i === 0 ? 0 : 1 })),
    fonte,
    origem: 'compilacao',
  };
}

/** Lista dos artigos da norma (só para normas com árvore de dispositivos). */
export async function indiceNorma(urn: string): Promise<{ urn: string; dispositivos: string[]; temArvore: boolean }> {
  const dados = await norma(urn);
  const ids = new Set<string>();
  percorrer(dados, (n) => {
    const id = idDispositivo(n);
    if (id && /^art\d+(-[a-z])?$/i.test(id)) ids.add(id);
  });
  return { urn, dispositivos: [...ids], temArvore: ids.size > 0 };
}

export async function senadoNorma(urn: string): Promise<unknown> {
  validarUrn(urn);
  return buscarJson(`https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn=${encodeURIComponent(urn)}`);
}

const cacheTexto = new Map<string, { em: number; dados: TextoCompleto }>();

export interface TextoCompleto {
  urn: string;
  fonte: string;
  origem: 'arvore' | 'compilacao';
  /** Parágrafos na ordem do texto; "id" = artigo (ex.: art48) no começo de cada artigo */
  texto: { id: string; texto: string; nivel: number }[];
}

/** Texto inteiro da norma (vigente), para ler e pesquisar dentro dela. */
export async function textoCompleto(urn: string): Promise<TextoCompleto> {
  const c = cacheTexto.get(urn);
  if (c && Date.now() - c.em < 6 * 3600_000) return c.dados;
  const dados = await norma(urn);
  const fonte = `https://normas.leg.br/?urn=${encodeURIComponent(urn)}`;
  let saida: TextoCompleto | null = null;

  const texto: TextoCompleto['texto'] = [];
  // Recuo contado a partir do artigo: títulos e artigos na margem; parágrafos, incisos e alíneas recuados
  let nivelArtigo = -1;
  percorrer(dados, (n, nivel) => {
    if (n === dados) return;
    const r = redacao(n);
    if (!r || (!r.texto && !r.rotulo)) return;
    const id = idDispositivo(n) || '';
    const ehArtigo = /^art\d+(-[a-z])?$/i.test(id);
    const linha = [r.rotulo, r.texto].filter(Boolean).join(' ');
    const titulo = !ehArtigo && (CABECALHO.test(linha) || /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO)\b/.test(linha));
    if (ehArtigo) nivelArtigo = nivel;
    if (titulo) nivelArtigo = -1;
    const recuo = ehArtigo || titulo || nivelArtigo < 0 ? 0 : Math.min(3, Math.max(1, nivel - nivelArtigo));
    texto.push({ id: ehArtigo ? id : '', texto: linha, nivel: recuo });
  });
  if (texto.length > 3) saida = { urn, fonte, origem: 'arvore', texto };

  if (!saida) {
    const enc = lista(dados?.encoding);
    const atual = enc.find((e) => e.version === 'Current') || enc[enc.length - 1];
    const url = String(atual?.contentUrl || '').replace('https://normas.leg.br/api/binario/', `${BASE}/binario/`);
    if (!url.startsWith(`${BASE}/binario/`)) throw new ErroApi(404, 'O normas.leg.br ainda não tem o texto desta norma. Use o link do Senado.');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    let html = '';
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'RA-Connect/0.1' } });
      if (!r.ok) throw new ErroApi(502, `normas.leg.br respondeu ${r.status} ao baixar o texto.`);
      html = new TextDecoder('utf-8').decode(await r.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
    let ps = paragrafosHtml(html);
    // Corta o cabeçalho técnico do arquivo (metadados, "Câmara dos Deputados"…) antes do título da norma
    const inicio = ps.slice(0, 40).findIndex((x) => /^(LEI|DECRETO|MEDIDA PROVIS|EMENDA CONSTITUCIONAL|CONSTITUI|RESOLU)/i.test(x));
    if (inicio > 0) ps = ps.slice(inicio);
    saida = {
      urn, fonte, origem: 'compilacao',
      texto: ps.slice(0, 8000).map((p) => {
        const m = p.match(/^Art\.\s*(\d+)(?:º|°|o)?(?:\s*-\s*([A-Z]))?/);
        return { id: m ? `art${m[1]}${m[2] ? `-${m[2].toLowerCase()}` : ''}` : '', texto: p, nivel: m || CABECALHO.test(p) || !/[a-zà-ú]/.test(p) ? 0 : 1 };
      }),
    };
  }
  cacheTexto.set(urn, { em: Date.now(), dados: saida });
  if (cacheTexto.size > 40) cacheTexto.delete(cacheTexto.keys().next().value!);
  return saida;
}
