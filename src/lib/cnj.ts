// Número único do CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO

import { somenteDigitos } from './cpf.js';

export interface NumeroCnj {
  digitos: string; // 20 dígitos
  formatado: string;
  sequencial: string;
  dv: string;
  ano: string;
  justica: string; // J
  tribunal: string; // TR
  origem: string; // OOOO
}

const UF_POR_TR: Record<string, string> = {
  '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce', '07': 'dft', '08': 'es',
  '09': 'go', '10': 'ma', '11': 'mt', '12': 'ms', '13': 'mg', '14': 'pa', '15': 'pb', '16': 'pr',
  '17': 'pe', '18': 'pi', '19': 'rj', '20': 'rn', '21': 'rs', '22': 'ro', '23': 'rr', '24': 'sc',
  '25': 'se', '26': 'sp', '27': 'to',
};

/** Resto de um número grande (string) por 97, sem perder precisão. */
function mod97(numero: string): number {
  let resto = 0;
  for (const ch of numero) resto = (resto * 10 + Number(ch)) % 97;
  return resto;
}

export function calcularDv(sequencial: string, ano: string, j: string, tr: string, origem: string): string {
  const r = mod97(sequencial + ano + j + tr + origem + '00');
  return String(98 - r).padStart(2, '0');
}

export function parseCnj(valor: string): NumeroCnj | null {
  const d = somenteDigitos(valor);
  if (d.length !== 20) return null;
  const n: NumeroCnj = {
    digitos: d,
    sequencial: d.slice(0, 7),
    dv: d.slice(7, 9),
    ano: d.slice(9, 13),
    justica: d.slice(13, 14),
    tribunal: d.slice(14, 16),
    origem: d.slice(16, 20),
    formatado: '',
  };
  n.formatado = `${n.sequencial}-${n.dv}.${n.ano}.${n.justica}.${n.tribunal}.${n.origem}`;
  return n;
}

export function cnjValido(valor: string): boolean {
  const n = parseCnj(valor);
  if (!n) return false;
  return calcularDv(n.sequencial, n.ano, n.justica, n.tribunal, n.origem) === n.dv;
}

/** Alias do DataJud para o tribunal do processo (ex.: trf1, tjma, trt16). */
export function aliasDataJud(valor: string): string | null {
  const n = parseCnj(valor);
  if (!n) return null;
  const tr = Number(n.tribunal);
  switch (n.justica) {
    case '3':
      return 'stj';
    case '4':
      return tr >= 1 && tr <= 6 ? `trf${tr}` : null;
    case '5':
      return tr === 0 ? 'tst' : tr >= 1 && tr <= 24 ? `trt${tr}` : null;
    case '6':
      return UF_POR_TR[n.tribunal] ? `tre-${UF_POR_TR[n.tribunal]}` : null;
    case '8':
      return UF_POR_TR[n.tribunal] ? `tj${UF_POR_TR[n.tribunal]}` : null;
    default:
      return null;
  }
}

export function formatarCnj(valor: string): string {
  return parseCnj(valor)?.formatado ?? valor;
}
