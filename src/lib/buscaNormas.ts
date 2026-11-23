// Busca no catálogo de normas federais (gerado por scripts/baixar-normas.mjs a partir do Senado).
// Funções puras: o servidor carrega o catálogo e usa estas regras para interpretar e ordenar.
//
// Entende, por exemplo:
//   "lei 8213", "8.213/91", "lei 8.213 de 1991", "decreto 3048", "LC 142", "EC 103/2019", "MP 1.164"
//   "CLT", "CPC", "LOAS", "RPS", "constituição"            → apelidos conhecidos
//   "aposentadoria rural", "salário-maternidade segurada especial" → palavras na ementa e nos apelidos
//   "art 48 da 8213"                                          → abre a Lei 8.213 já no art. 48

export type TipoNorma = 'CON' | 'EMC' | 'LCP' | 'LEI' | 'DEL' | 'MPV' | 'DEC' | 'DLG' | 'DPL' | 'RSF';

/** [id, tipo, número, data ISO, nome, ementa, apelidos] — formato do arquivo do catálogo */
export type ItemCatalogo = [string, TipoNorma, string, string, string, string, string[]];

export const ROTULO_TIPO_NORMA: Record<TipoNorma, string> = {
  CON: 'Constituição',
  EMC: 'Emenda Constitucional',
  LCP: 'Lei Complementar',
  LEI: 'Lei',
  DEL: 'Decreto-Lei',
  MPV: 'Medida Provisória',
  DEC: 'Decreto',
  DLG: 'Decreto Legislativo',
  DPL: 'Decreto do Poder Legislativo',
  RSF: 'Resolução do Senado',
};

const SEM_ACENTO: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n', '–': '-', '—': '-',
};

/** Minúsculas e sem acento. Troca direta de letras (bem mais rápida que normalize('NFD') em 200 mil ementas). */
export const normalizarTexto = (s: string) =>
  (s || '').toLowerCase().replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ–—]/g, (c) => SEM_ACENTO[c]).replace(/\s+/g, ' ').trim();

/**
 * Assuntos do dia a dia do escritório → normas principais.
 * Quando a busca toca o assunto, essas normas vêm primeiro, mesmo que a ementa não use as mesmas palavras
 * (a ementa da Lei 8.213 não fala em "aposentadoria rural").
 */
export const ASSUNTOS: { palavras: string[]; normas: { tipo: TipoNorma; numero: string; ano: string }[] }[] = [
  { palavras: ['aposentadoria'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'EMC', numero: '103', ano: '2019' }, { tipo: 'DEC', numero: '3048', ano: '1999' }] },
  { palavras: ['aposentadoria', 'deficiencia'], normas: [{ tipo: 'LCP', numero: '142', ano: '2013' }] },
  { palavras: ['rural'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'LEI', numero: '11718', ano: '2008' }, { tipo: 'LEI', numero: '5889', ano: '1973' }] },
  { palavras: ['segurado', 'especial'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'LEI', numero: '8212', ano: '1991' }, { tipo: 'LEI', numero: '11718', ano: '2008' }] },
  { palavras: ['salario-maternidade'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'DEC', numero: '3048', ano: '1999' }] },
  { palavras: ['maternidade'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }] },
  { palavras: ['pensao'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'EMC', numero: '103', ano: '2019' }] },
  { palavras: ['auxilio'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'DEC', numero: '3048', ano: '1999' }] },
  { palavras: ['incapacidade'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }] },
  { palavras: ['beneficio', 'previdenci'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'DEC', numero: '3048', ano: '1999' }] },
  { palavras: ['previdencia'], normas: [{ tipo: 'LEI', numero: '8213', ano: '1991' }, { tipo: 'LEI', numero: '8212', ano: '1991' }, { tipo: 'EMC', numero: '103', ano: '2019' }] },
  { palavras: ['bpc'], normas: [{ tipo: 'LEI', numero: '8742', ano: '1993' }, { tipo: 'DEC', numero: '6214', ano: '2007' }] },
  { palavras: ['prestacao', 'continuada'], normas: [{ tipo: 'LEI', numero: '8742', ano: '1993' }, { tipo: 'DEC', numero: '6214', ano: '2007' }] },
  { palavras: ['assistencia', 'social'], normas: [{ tipo: 'LEI', numero: '8742', ano: '1993' }] },
  { palavras: ['juizado'], normas: [{ tipo: 'LEI', numero: '10259', ano: '2001' }, { tipo: 'LEI', numero: '9099', ano: '1995' }] },
  { palavras: ['recurso', 'inominado'], normas: [{ tipo: 'LEI', numero: '9099', ano: '1995' }, { tipo: 'LEI', numero: '10259', ano: '2001' }] },
  { palavras: ['rpv'], normas: [{ tipo: 'LEI', numero: '10259', ano: '2001' }] },
  { palavras: ['prazo', 'processual'], normas: [{ tipo: 'LEI', numero: '13105', ano: '2015' }] },
  { palavras: ['gratuidade'], normas: [{ tipo: 'LEI', numero: '13105', ano: '2015' }, { tipo: 'LEI', numero: '1060', ano: '1950' }] },
  { palavras: ['justica', 'gratuita'], normas: [{ tipo: 'LEI', numero: '13105', ano: '2015' }, { tipo: 'LEI', numero: '1060', ano: '1950' }] },
  { palavras: ['processo', 'administrativo'], normas: [{ tipo: 'LEI', numero: '9784', ano: '1999' }] },
  { palavras: ['honorario'], normas: [{ tipo: 'LEI', numero: '8906', ano: '1994' }, { tipo: 'LEI', numero: '13105', ano: '2015' }] },
  { palavras: ['trabalhista'], normas: [{ tipo: 'DEL', numero: '5452', ano: '1943' }, { tipo: 'LEI', numero: '13467', ano: '2017' }] },
  { palavras: ['consumidor'], normas: [{ tipo: 'LEI', numero: '8078', ano: '1990' }] },
  { palavras: ['dano', 'moral'], normas: [{ tipo: 'LEI', numero: '10406', ano: '2002' }, { tipo: 'LEI', numero: '8078', ano: '1990' }] },
  { palavras: ['idoso'], normas: [{ tipo: 'LEI', numero: '10741', ano: '2003' }] },
  { palavras: ['deficiencia'], normas: [{ tipo: 'LEI', numero: '13146', ano: '2015' }] },
  { palavras: ['dados', 'pessoais'], normas: [{ tipo: 'LEI', numero: '13709', ano: '2018' }] },
];

/** Apelidos de uso diário que nem sempre estão no cadastro do Senado. */
export const APELIDOS: { nomes: string[]; tipo: TipoNorma; numero: string; ano?: string }[] = [
  { nomes: ['cf', 'crfb', 'cf/88', 'constituicao', 'constituicao federal', 'constituicao de 1988'], tipo: 'CON', numero: '', ano: '1988' },
  { nomes: ['clt', 'consolidacao das leis do trabalho'], tipo: 'DEL', numero: '5452', ano: '1943' },
  { nomes: ['cpc', 'novo cpc', 'codigo de processo civil'], tipo: 'LEI', numero: '13105', ano: '2015' },
  { nomes: ['cc', 'codigo civil'], tipo: 'LEI', numero: '10406', ano: '2002' },
  { nomes: ['cp', 'codigo penal'], tipo: 'DEL', numero: '2848', ano: '1940' },
  { nomes: ['cpp', 'codigo de processo penal'], tipo: 'DEL', numero: '3689', ano: '1941' },
  { nomes: ['ctn', 'codigo tributario nacional'], tipo: 'LEI', numero: '5172', ano: '1966' },
  { nomes: ['cdc', 'codigo de defesa do consumidor'], tipo: 'LEI', numero: '8078', ano: '1990' },
  { nomes: ['lbps', 'pbps', 'lei de beneficios', 'plano de beneficios'], tipo: 'LEI', numero: '8213', ano: '1991' },
  { nomes: ['pcss', 'lei de custeio', 'plano de custeio'], tipo: 'LEI', numero: '8212', ano: '1991' },
  { nomes: ['rps', 'regulamento da previdencia social', 'regulamento da previdencia'], tipo: 'DEC', numero: '3048', ano: '1999' },
  { nomes: ['loas', 'lei organica da assistencia social'], tipo: 'LEI', numero: '8742', ano: '1993' },
  { nomes: ['lei dos juizados especiais federais', 'lei do jef', 'jef'], tipo: 'LEI', numero: '10259', ano: '2001' },
  { nomes: ['lei dos juizados especiais', 'lei 9099', 'jec'], tipo: 'LEI', numero: '9099', ano: '1995' },
  { nomes: ['eca', 'estatuto da crianca e do adolescente'], tipo: 'LEI', numero: '8069', ano: '1990' },
  { nomes: ['estatuto do idoso', 'estatuto da pessoa idosa'], tipo: 'LEI', numero: '10741', ano: '2003' },
  { nomes: ['lbi', 'estatuto da pessoa com deficiencia', 'lei brasileira de inclusao'], tipo: 'LEI', numero: '13146', ano: '2015' },
  { nomes: ['lgpd', 'lei geral de protecao de dados'], tipo: 'LEI', numero: '13709', ano: '2018' },
  { nomes: ['lindb', 'lei de introducao'], tipo: 'DEL', numero: '4657', ano: '1942' },
  { nomes: ['eoab', 'estatuto da advocacia', 'estatuto da oab'], tipo: 'LEI', numero: '8906', ano: '1994' },
  { nomes: ['lei maria da penha'], tipo: 'LEI', numero: '11340', ano: '2006' },
  { nomes: ['lei do inquilinato'], tipo: 'LEI', numero: '8245', ano: '1991' },
  { nomes: ['lei de improbidade', 'lia'], tipo: 'LEI', numero: '8429', ano: '1992' },
  { nomes: ['lei de execucao fiscal', 'lef'], tipo: 'LEI', numero: '6830', ano: '1980' },
  { nomes: ['lei de falencias', 'lei de recuperacao judicial'], tipo: 'LEI', numero: '11101', ano: '2005' },
  { nomes: ['lei do mandado de seguranca'], tipo: 'LEI', numero: '12016', ano: '2009' },
  { nomes: ['lei do processo administrativo', 'lei 9784'], tipo: 'LEI', numero: '9784', ano: '1999' },
  { nomes: ['reforma da previdencia', 'ec 103'], tipo: 'EMC', numero: '103', ano: '2019' },
  { nomes: ['reforma trabalhista'], tipo: 'LEI', numero: '13467', ano: '2017' },
  { nomes: ['lei do fgts', 'fgts'], tipo: 'LEI', numero: '8036', ano: '1990' },
  { nomes: ['lei do seguro-desemprego', 'seguro-desemprego', 'seguro desemprego'], tipo: 'LEI', numero: '7998', ano: '1990' },
  { nomes: ['lei da assistencia judiciaria', 'lei 1060'], tipo: 'LEI', numero: '1060', ano: '1950' },
];

// Palavras que indicam o tipo (as mais longas primeiro)
const PALAVRAS_TIPO: [RegExp, TipoNorma][] = [
  [/\blei complementar\b|\blcp?\b/, 'LCP'],
  [/\bdecreto[- ]lei\b|\bdel\b|\bdl\b/, 'DEL'],
  [/\bdecreto legislativo\b|\bdlg\b/, 'DLG'],
  [/\bmedida provisoria\b|\bmpv?\b/, 'MPV'],
  [/\bemenda constitucional\b|\bemenda\b|\bec\b/, 'EMC'],
  [/\bresolucao( do senado)?\b|\brsf\b/, 'RSF'],
  [/\bdecreto\b|\bdec\b/, 'DEC'],
  [/\blei\b|\blei ordinaria\b/, 'LEI'],
];

const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'que', 'sobre', 'n', 'no.', 'nº', 'numero']);

export interface Consulta {
  tipo?: TipoNorma;
  numero?: string;
  ano?: string;
  artigo?: string;
  termos: string[];
  apelido?: { tipo: TipoNorma; numero: string; ano?: string };
}

function anoCompleto(a: string): string {
  if (a.length === 4) return a;
  const n = Number(a);
  const atual = new Date().getFullYear() % 100;
  return String(n <= atual ? 2000 + n : 1900 + n);
}

/** Separa tipo, número, ano, artigo e palavras da busca. */
export function interpretar(bruto: string): Consulta {
  let t = normalizarTexto(bruto).replace(/[“”"']/g, ' ');
  const c: Consulta = { termos: [] };

  const ap = APELIDOS.find((a) => a.nomes.includes(t.replace(/[.,;]+$/, '')));
  if (ap) {
    c.apelido = { tipo: ap.tipo, numero: ap.numero, ano: ap.ano };
    return c;
  }

  // Artigo: "art 48", "art. 48-a", "artigo 201"
  const art = t.match(/\bart(?:igo)?s?\.?\s*(\d+)(?:\s*-\s*([a-z])\b)?(?:\s*(?:º|o)\b)?/);
  if (art) {
    c.artigo = `art${art[1]}${art[2] ? `-${art[2]}` : ''}`;
    t = (t.slice(0, art.index) + ' ' + t.slice(art.index! + art[0].length)).trim();
  }

  // Apelido dentro de uma frase maior ("art 48 da lbps", "loas art 20")
  const resto = t.replace(/^(da|do|de)\s+/, '').trim();
  const ap2 = APELIDOS.find((a) => a.nomes.includes(resto));
  if (ap2) {
    c.apelido = { tipo: ap2.tipo, numero: ap2.numero, ano: ap2.ano };
    return c;
  }

  for (const [re, tipo] of PALAVRAS_TIPO) {
    if (re.test(t)) {
      c.tipo = tipo;
      t = t.replace(re, ' ');
      break;
    }
  }

  // Número com ano: 8.213/91, 8213/1991, 8.213 de 1991, 13.105, de 16 de março de 2015
  const num = t.match(/(?:^|\s)(\d{1,3}(?:\.\d{3})+|\d{1,6})(?:\s*\/\s*(\d{2}|\d{4})\b|,?\s+de\s+(?:\d{1,2}\s+de\s+\w+\s+de\s+)?(\d{4})\b)?/);
  if (num) {
    c.numero = num[1].replace(/\./g, '').replace(/^0+(?=\d)/, '');
    if (num[2] || num[3]) c.ano = anoCompleto(num[2] || num[3]);
    t = t.replace(num[0], ' ');
  } else {
    const ano = t.match(/\b(18|19|20)\d{2}\b/);
    if (ano && c.tipo) { c.ano = ano[0]; t = t.replace(ano[0], ' '); }
  }

  c.termos = t
    .split(/[\s,;:()/]+/)
    .map((p) => p.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((p) => p.length > 1 && !VAZIAS.has(p));
  // "aposentadoria rural 1991": sem tipo e com palavras, um número com cara de ano é o ano
  if (!c.tipo && !c.ano && c.numero && c.termos.length && /^(18|19|20)\d{2}$/.test(c.numero)) {
    c.ano = c.numero;
    delete c.numero;
  }
  return c;
}

/** Palavra → forma usada na comparação (plural simples: "rurais" → "rura", "beneficios" → "beneficio"). */
function raiz(p: string): string {
  if (p.length > 5 && p.endsWith('ais')) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith('oes')) return p.slice(0, -3);
  if (p.length > 3 && p.endsWith('s')) return p.slice(0, -1);
  return p;
}

export interface NormaIndexada {
  item: ItemCatalogo;
  alvo: string; // ementa + apelidos, normalizado
  apelidos: string;
  ementa: string;
  ano: string;
  chave: string; // tipo|número|ano
}

export function indexar(itens: ItemCatalogo[]): NormaIndexada[] {
  return itens.map((item) => {
    const apelidos = normalizarTexto(item[6].join(' | '));
    const ementa = normalizarTexto(item[5]);
    const ano = item[3].slice(0, 4);
    return { item, apelidos, ementa, alvo: `${ementa} | ${apelidos}`, ano, chave: `${item[1]}|${item[2]}|${ano}` };
  });
}

const PESO_TIPO: Record<TipoNorma, number> = { CON: 90, LCP: 45, LEI: 50, DEL: 35, EMC: 35, MPV: 10, DEC: 15, DLG: 0, DPL: 0, RSF: 0 };

export interface FiltrosNorma { tipo?: TipoNorma | ''; desde?: string; ate?: string }

export interface ResultadoBusca {
  consulta: Consulta;
  total: number;
  itens: { item: ItemCatalogo; destaque: string[]; principal: boolean; parcial: boolean }[];
}

/** Normas principais dos assuntos que a busca toca (ex.: "aposentadoria rural" → Lei 8.213, Lei 11.718…). */
export function normasDoAssunto(termos: string[]): Map<string, number> {
  const chaves = new Map<string, number>();
  const tem = (w: string) => termos.some((t) => t.startsWith(w) || (t.length >= 4 && w.startsWith(t)));
  for (const a of ASSUNTOS) if (a.palavras.every(tem)) for (const n of a.normas) { const k = `${n.tipo}|${n.numero}|${n.ano}`; chaves.set(k, (chaves.get(k) || 0) + 1); }
  return chaves;
}

/**
 * Busca e ordena: apelido conhecido > número exato > norma principal do assunto >
 * todas as palavras no apelido > na ementa. Se poucas normas têm todas as palavras,
 * entram as que têm quase todas (marcadas como parciais).
 */
export function buscarNormas(base: NormaIndexada[], q: string, filtros: FiltrosNorma = {}, pagina = 1, porPagina = 20): ResultadoBusca {
  const c = interpretar(q);
  const tipo = c.apelido?.tipo ?? (filtros.tipo || c.tipo);
  const numero = c.apelido ? c.apelido.numero : c.numero;
  const ano = c.apelido?.ano ?? c.ano;
  const termos = c.termos.map(raiz);
  const frase = termos.length > 1 ? normalizarTexto(c.termos.join(' ')) : '';
  if (!tipo && numero === undefined && !termos.length && !c.apelido) return { consulta: c, total: 0, itens: [] };
  const principais = numero === undefined && !c.apelido ? normasDoAssunto(termos) : new Map<string, number>();
  const minimoParcial = termos.length >= 2 ? termos.length - 1 : Infinity;

  type Achado = { n: NormaIndexada; pontos: number; principal: boolean; parcial: boolean };
  const completos: Achado[] = [];
  const parciais: Achado[] = [];
  for (const n of base) {
    const [, t, num] = n.item;
    if (tipo && t !== tipo) continue;
    if (filtros.desde && n.item[3] < filtros.desde) continue;
    if (filtros.ate && n.item[3] > filtros.ate) continue;
    if (numero !== undefined && numero !== '' && num !== numero) continue;
    if (numero === '' && c.apelido && num !== '') continue;
    if (ano && n.ano !== ano) continue;
    const principal = principais.has(n.chave);
    const batem = termos.filter((p) => n.alvo.includes(p)).length;
    const parcial = !principal && batem < termos.length;
    if (parcial && batem < minimoParcial) continue;

    let pontos = PESO_TIPO[t];
    if (numero !== undefined) pontos += 1000;
    if (c.apelido) pontos += 2000;
    if (principal) pontos += 1200 + 300 * principais.get(n.chave)!;
    if (termos.length) {
      const noApelido = termos.filter((p) => n.apelidos.includes(p)).length;
      pontos += noApelido * 40 + (noApelido === termos.length ? 260 : 0);
      if (frase && n.alvo.includes(frase)) pontos += 120;
      // A ementa que começa pelo assunto ("Dispõe sobre a aposentadoria…") vale mais que a que só cita
      const inicio = n.ementa.slice(0, 120);
      pontos += termos.filter((p) => inicio.includes(p)).length * 15 + batem * 30;
    }
    // Leis que só alteram outras e créditos orçamentários raramente são o que se procura
    if (/^(altera|acrescenta|da nova redacao|revoga)/.test(n.ementa)) pontos -= 25;
    if (/^abre.*credito|^autoriza .*(abrir|abertura).*credito|^fixa a despesa|^orca a receita/.test(n.ementa)) pontos -= 60;
    pontos += (Number(n.ano) - 1900) / 25;
    (parcial ? parciais : completos).push({ n, pontos, principal, parcial });
  }
  const achados = completos.length < 10 ? [...completos, ...parciais] : completos;
  achados.sort((a, b) => Number(a.parcial) - Number(b.parcial) || b.pontos - a.pontos || b.n.item[3].localeCompare(a.n.item[3]));
  const ini = (Math.max(1, pagina) - 1) * porPagina;
  return {
    consulta: c,
    total: achados.length,
    itens: achados.slice(ini, ini + porPagina).map((a) => ({ item: a.n.item, destaque: c.termos, principal: a.principal, parcial: a.parcial })),
  };
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Referência para citar: "Lei nº 8.213, de 24 de julho de 1991" */
export function referenciaNorma(tipo: TipoNorma, numero: string, dataIso: string, nome = ''): string {
  if (tipo === 'CON') return nome || 'Constituição da República Federativa do Brasil de 1988';
  const [a, m, d] = dataIso.split('-');
  const n = /^\d+$/.test(numero) ? Number(numero).toLocaleString('pt-BR') : numero;
  const data = a && m && d ? `, de ${Number(d)}${d === '01' ? 'º' : ''} de ${MESES[Number(m) - 1]} de ${a}` : '';
  return `${ROTULO_TIPO_NORMA[tipo]} nº ${n}${data}`;
}
