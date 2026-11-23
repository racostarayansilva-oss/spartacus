// Intimação da Controladoria a partir de uma comunicação do DJEN (usado na tela e no monitor automático).
import type { Intimacao } from '../store.js';

/** Sugere o prazo pelo texto da intimação. */
export function sugerirDias(texto: string): number {
  const t = texto.toLowerCase();
  const m = t.match(/prazo de (\d{1,3}) ?(\(\w+\) )?dias|em (\d{1,3}) ?(\(\w+\) )?dias/);
  if (m) return Number(m[1] || m[3]);
  if (/embargos/.test(t)) return 5;
  if (/juizado|jef|recurso inominado/.test(t)) return 10;
  return 15;
}

export interface ComunicacaoResumo { id: string; disponibilizacao: string; tribunal: string; processo: string; orgao?: string; tipo?: string; texto: string }

export const idIntimacaoDjen = (c: { id: string }) => `djen-${c.id}`;

export function intimacaoDaComunicacao(c: ComunicacaoResumo): Intimacao {
  return {
    id: idIntimacaoDjen(c), disponibilizacao: c.disponibilizacao, tribunal: c.tribunal, processoNumero: c.processo,
    texto: `${c.tipo ? c.tipo + ' — ' : ''}${c.orgao ? c.orgao + ': ' : ''}${c.texto}`.slice(0, 4000),
    dias: sugerirDias(c.texto), status: 'nova', origem: 'djen',
  };
}
