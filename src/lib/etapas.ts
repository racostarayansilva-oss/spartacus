import { DataISO, diasEntre } from './datas.js';

export type TipoProcesso = 'JEF' | 'ADM_INSS' | 'CIVEL' | 'TRABALHISTA';

export const ROTULO_TIPO: Record<TipoProcesso, string> = {
  JEF: 'JEF',
  ADM_INSS: 'Administrativo INSS',
  CIVEL: 'Cível',
  TRABALHISTA: 'Trabalhista',
};

export const ETAPAS: Record<TipoProcesso, string[]> = {
  JEF: ['Entrada', 'Documentação', 'DER no INSS', 'Decisão INSS', 'Ajuizamento', 'Citação/contestação', 'Audiência/perícia', 'Sentença', 'Recurso', 'RPV/pagamento'],
  ADM_INSS: ['Entrada', 'Documentação', 'DER', 'Exigência', 'Decisão INSS', 'Recurso'],
  CIVEL: ['Entrada', 'Ajuizamento', 'Citação/contestação', 'Réplica', 'Audiência/perícia', 'Sentença', 'Recurso', 'Cumprimento'],
  TRABALHISTA: ['Entrada', 'Ajuizamento', 'Audiência/perícia', 'Sentença', 'Recurso', 'Execução'],
};

export interface EtapaRegistrada {
  etapa: string;
  data: DataISO;
  obs?: string;
  /** Para sentença: procedente | parcial | improcedente */
  resultado?: string;
}

/** Etapas que, ao serem registradas na ficha, também contam no Painel. */
export const ETAPA_PARA_REGISTRO: Record<string, 'protocolo' | 'sentenca' | 'recurso' | 'audiencia'> = {
  'DER no INSS': 'protocolo',
  DER: 'protocolo',
  Ajuizamento: 'protocolo',
  Sentença: 'sentenca',
  Recurso: 'recurso',
  'Audiência/perícia': 'audiencia',
};

export interface LinhaVida extends EtapaRegistrada {
  diasDesdeAnterior: number | null;
  /** Posição da etapa no array original (para editar ou remover) */
  indice: number;
}

export function vidaDoProcesso(etapas: EtapaRegistrada[]): LinhaVida[] {
  const ordenadas = etapas.map((e, indice) => ({ ...e, indice })).sort((a, b) => a.data.localeCompare(b.data));
  return ordenadas.map((e, i) => ({
    ...e,
    diasDesdeAnterior: i === 0 ? null : diasEntre(ordenadas[i - 1].data, e.data),
  }));
}

export interface IndicadoresFicha {
  diasDeVida: number | null;
  diasAteDecisao: number | null;
  diasParado: number | null;
}

const ETAPAS_DECISAO = ['Decisão INSS', 'Sentença'];

export function indicadoresFicha(etapas: EtapaRegistrada[], referencia: DataISO, ultimaMovOficial?: DataISO): IndicadoresFicha {
  if (!etapas.length) return { diasDeVida: null, diasAteDecisao: null, diasParado: null };
  const ord = [...etapas].sort((a, b) => a.data.localeCompare(b.data));
  const entrada = ord[0].data;
  const decisao = ord.find((e) => ETAPAS_DECISAO.includes(e.etapa));
  let ultima = ord[ord.length - 1].data;
  if (ultimaMovOficial && ultimaMovOficial > ultima) ultima = ultimaMovOficial;
  return {
    diasDeVida: diasEntre(entrada, referencia),
    diasAteDecisao: decisao ? diasEntre(entrada, decisao.data) : null,
    diasParado: diasEntre(ultima, referencia),
  };
}

export function faseAtual(etapas: EtapaRegistrada[]): string {
  if (!etapas.length) return 'Entrada';
  return [...etapas].sort((a, b) => a.data.localeCompare(b.data)).at(-1)!.etapa;
}
