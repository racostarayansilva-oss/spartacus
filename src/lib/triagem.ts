// Triagem automática do grupo familiar (CadÚnico).
// - Aposentadoria rural: 55 anos (mulher) / 60 anos (homem) — Lei 8.213/91, art. 48, §1º.
// - Salário-maternidade: parto nos últimos 5 anos (prescrição quinquenal) e gestantes.
// - BPC idoso: 65 anos ou mais — LOAS, art. 20.
// A triagem só aponta possibilidades; carência, qualidade de segurado e renda precisam ser analisadas.

import { DataISO, idade, somarAnos } from './datas.js';

export type Sexo = 'F' | 'M';

export interface MembroFamilia {
  id: string;
  nome: string;
  parentesco: string;
  sexo: Sexo;
  nascimento: DataISO;
  ultimoParto?: DataISO | null;
  partoPrevisto?: DataISO | null;
}

export interface ItemAposentadoria {
  membro: MembroFamilia;
  idadeMinima: number;
  dataQueCompleta: DataISO;
  idadeAtual: number;
  situacao: 'atingiu' | 'proximos5anos';
}

export interface ItemMaternidade {
  membro: MembroFamilia;
  tipo: 'parto' | 'gestante';
  data: DataISO;
  /** Até quando dá para pedir (parto + 5 anos). Para gestante, conta do parto previsto. */
  dataLimite: DataISO;
}

export interface ItemBpc {
  membro: MembroFamilia;
  idadeAtual: number;
  dataQueCompletou: DataISO;
}

export interface ResultadoTriagem {
  aposentadoriaRural: ItemAposentadoria[];
  salarioMaternidade: ItemMaternidade[];
  bpcIdoso: ItemBpc[];
}

export const IDADE_RURAL: Record<Sexo, number> = { F: 55, M: 60 };
export const IDADE_BPC = 65;
export const ANOS_JANELA = 5;

export function triagemGrupoFamiliar(membros: MembroFamilia[], referencia: DataISO): ResultadoTriagem {
  const r: ResultadoTriagem = { aposentadoriaRural: [], salarioMaternidade: [], bpcIdoso: [] };
  const limiteJanela = somarAnos(referencia, ANOS_JANELA);
  const inicioJanela = somarAnos(referencia, -ANOS_JANELA);

  for (const m of membros) {
    if (!m.nascimento) continue;
    const idadeAtual = idade(m.nascimento, referencia);

    const minima = IDADE_RURAL[m.sexo];
    const completa = somarAnos(m.nascimento, minima);
    if (completa <= referencia) {
      r.aposentadoriaRural.push({ membro: m, idadeMinima: minima, dataQueCompleta: completa, idadeAtual, situacao: 'atingiu' });
    } else if (completa <= limiteJanela) {
      r.aposentadoriaRural.push({ membro: m, idadeMinima: minima, dataQueCompleta: completa, idadeAtual, situacao: 'proximos5anos' });
    }

    if (m.sexo === 'F' && m.ultimoParto && m.ultimoParto >= inicioJanela && m.ultimoParto <= referencia) {
      r.salarioMaternidade.push({ membro: m, tipo: 'parto', data: m.ultimoParto, dataLimite: somarAnos(m.ultimoParto, ANOS_JANELA) });
    }
    if (m.sexo === 'F' && m.partoPrevisto && m.partoPrevisto >= referencia) {
      r.salarioMaternidade.push({ membro: m, tipo: 'gestante', data: m.partoPrevisto, dataLimite: somarAnos(m.partoPrevisto, ANOS_JANELA) });
    }

    if (idadeAtual >= IDADE_BPC) {
      r.bpcIdoso.push({ membro: m, idadeAtual, dataQueCompletou: somarAnos(m.nascimento, IDADE_BPC) });
    }
  }

  r.aposentadoriaRural.sort((a, b) => a.dataQueCompleta.localeCompare(b.dataQueCompleta));
  r.salarioMaternidade.sort((a, b) => a.dataLimite.localeCompare(b.dataLimite));
  return r;
}
