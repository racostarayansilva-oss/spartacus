// Rótulos da situação da RPV (processos em fase de execução).
import type { SituacaoRpv } from '../store';

export const ROTULO_SITUACAO_RPV: Record<SituacaoRpv, string> = {
  calculos: 'Cálculos / homologação pendente',
  aguardando_expedicao: 'Aguardando expedição da RPV',
  expedida: 'RPV expedida, aguardando envio ao TRF1',
  trf1: 'RPV no TRF1, aguardando pagamento',
  paga: 'RPV paga',
};
