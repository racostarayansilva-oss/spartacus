// Marca (white label): nome, logo e cores de cada escritório.
// Antes do login a marca vem do endereço (subdomínio ou domínio próprio); depois, do escritório da pessoa.
// As cores viram variáveis CSS calculadas para o tema claro e o escuro, sempre com contraste legível.

import { useSyncExternalStore } from 'react';

export interface Marca {
  /** Nome completo do escritório (aparece no login, nos documentos e no rodapé) */
  nome?: string;
  /** Nome curto para a barra lateral (até ~18 letras) */
  nomeCurto?: string;
  subtitulo?: string;
  /** Logo em data URL (PNG, SVG, JPG ou WebP) */
  logo?: string;
  corPrimaria?: string;
  corDestaque?: string;
  /** Linha do rodapé da página inicial (ex.: OAB e endereço) */
  rodape?: string;
}

export interface EscritorioPublico {
  id: string;
  slug: string;
  nome: string;
  marca: Marca;
  situacao?: string;
  plano?: string;
  modulos_desligados?: string[];
  implantacao?: Record<string, any>;
  dominios?: string[];
}

export const PRODUTO = 'Spartacus';
export const MARCA_PADRAO: Required<Pick<Marca, 'nome' | 'subtitulo' | 'corPrimaria' | 'corDestaque'>> = {
  nome: PRODUTO,
  subtitulo: 'SOFTWARE JURÍDICO',
  corPrimaria: '#0131CD',
  corDestaque: '#B9FC01',
};

// ---------- cores ----------

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const corValida = (c?: string): c is string => !!c && HEX.test(c.trim());

function rgb(hex: string): [number, number, number] {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const paraHex = (c: number[]) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');

/** Mistura a cor a com b (t = 0 → a; t = 1 → b). */
export function misturar(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return paraHex(x.map((v, i) => v + (y[i] - v) * t));
}

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto que fica legível sobre a cor (branco ou quase preto). */
export const sobre = (fundo: string) => (contraste('#ffffff', fundo) >= contraste('#0b0e11', fundo) ? '#ffffff' : '#0b0e11');

/** Clareia (ou escurece) a cor até atingir o contraste mínimo com o fundo. */
export function legivelSobre(cor: string, fundo: string, minimo = 4.5): string {
  if (contraste(cor, fundo) >= minimo) return cor;
  const alvo = luminancia(fundo) < 0.5 ? '#ffffff' : '#000000';
  for (let t = 0.1; t <= 1; t += 0.05) {
    const c = misturar(cor, alvo, t);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return alvo;
}

const FUNDO_ESCURO = '#0b0e11';
const SUPERFICIE_ESCURA = '#1e2329';

/** Variáveis CSS da marca para os dois temas. */
export function tokensDaMarca(m: Marca): { claro: Record<string, string>; escuro: Record<string, string>; comum: Record<string, string> } {
  const norm = (c: string) => paraHex(rgb(c));
  const p = norm(corValida(m.corPrimaria) ? m.corPrimaria : MARCA_PADRAO.corPrimaria);
  const d = norm(corValida(m.corDestaque) ? m.corDestaque : MARCA_PADRAO.corDestaque);
  const lateral = luminancia(p) > 0.25 ? misturar(p, '#000000', 0.72) : misturar(p, '#000000', 0.55);
  const comum = {
    '--destaque': d,
    '--sobre-destaque': sobre(d),
    '--lateral': lateral,
    '--lateral-2': misturar(lateral, '#ffffff', 0.1),
    '--lateral-borda': misturar(lateral, '#ffffff', 0.16),
    '--lateral-ativo': legivelSobre(d, lateral, 4.5),
  };
  const pClaro = legivelSobre(p, '#ffffff', 4.5);
  const claro = {
    '--primario': pClaro,
    '--primario-ativo': misturar(pClaro, '#000000', 0.15),
    '--primario-desligado': misturar(pClaro, '#ffffff', 0.7),
    '--primario-suave': misturar(pClaro, '#ffffff', 0.9),
    '--sobre-primario': sobre(pClaro),
    '--link': pClaro,
  };
  const pEscuro = legivelSobre(p, SUPERFICIE_ESCURA, 4.5);
  const escuro = {
    '--primario': pEscuro,
    '--primario-ativo': misturar(pEscuro, '#ffffff', 0.15),
    '--primario-desligado': misturar(pEscuro, FUNDO_ESCURO, 0.7),
    '--primario-suave': misturar(pEscuro, FUNDO_ESCURO, 0.82),
    '--sobre-primario': sobre(pEscuro),
    '--link': pEscuro,
  };
  return { claro, escuro, comum };
}

/** CSS que sobrepõe as cores padrão (mesma especificidade do styles.css, vem depois). */
export function cssDaMarca(m: Marca): string {
  const t = tokensDaMarca(m);
  const bloco = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v};`).join('');
  return [
    `:root{${bloco(t.comum)}${bloco(t.escuro)}}`,
    `:root[data-theme='light']{${bloco(t.claro)}}`,
    `@media (prefers-color-scheme: light){:root[data-theme='system']{${bloco(t.claro)}}}`,
  ].join('\n');
}

// ---------- estado ----------

interface EstadoMarca { escritorio: EscritorioPublico | null; marca: Marca }
let est: EstadoMarca = { escritorio: null, marca: { ...MARCA_PADRAO } };
const ouvintes = new Set<() => void>();

export function useMarca(): EstadoMarca {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => est);
}
export const marcaAtual = () => est;

/** Nome que aparece na barra lateral. */
export function nomeExibido(m: Marca): string {
  return (m.nomeCurto || m.nome || PRODUTO).trim();
}

export function definirEscritorio(e: EscritorioPublico | null) {
  const marca: Marca = { ...MARCA_PADRAO, ...(e ? { nome: e.nome } : {}), ...(e?.marca || {}) };
  est = { escritorio: e, marca };
  aplicarNoDocumento(marca);
  ouvintes.forEach((o) => o());
}

function aplicarNoDocumento(m: Marca) {
  if (typeof document === 'undefined') return;
  let tag = document.getElementById('marca-escritorio') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'marca-escritorio';
    document.head.appendChild(tag);
  }
  tag.textContent = cssDaMarca(m);
  document.title = m.nome && m.nome !== PRODUTO ? `${nomeExibido(m)} · ${PRODUTO}` : PRODUTO;
  const icone = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icone) icone.href = m.logo || '/logo.svg';
}

// ---------- qual escritório é este endereço ----------

const CHAVE_ESCOLHA = 'spartacus:escritorio';

/**
 * Endereço do escritório: ?escritorio=slug (testes e endereço único) tem prioridade; senão o subdomínio
 * (slug.dominio-da-plataforma) ou o domínio próprio. No endereço da plataforma não há escritório.
 */
export function hostDoEscritorio(loc: { hostname: string; search: string }, dominioPlataforma: string): string | null {
  const param = new URLSearchParams(loc.search).get('escritorio');
  if (param) {
    try { sessionStorage.setItem(CHAVE_ESCOLHA, param); } catch { /* sem armazenamento */ }
    return param.toLowerCase();
  }
  try {
    const salvo = sessionStorage.getItem(CHAVE_ESCOLHA);
    if (salvo) return salvo;
  } catch { /* sem armazenamento */ }
  const host = loc.hostname.toLowerCase();
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.endsWith('.vercel.app')) return null;
  const base = dominioPlataforma.toLowerCase().replace(/^\.+/, '');
  if (base && (host === base || host === `www.${base}` || host === `app.${base}`)) return null;
  return host;
}
