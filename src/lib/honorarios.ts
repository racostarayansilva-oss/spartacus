export interface ResultadoRpv {
  valorRpv: number;
  percentual: number;
  honorarios: number;
  liquidoCliente: number;
}

/** Honorários contratuais sobre RPV: valor × percentual, separando o líquido do cliente. Arredonda em centavos. */
export function honorariosSobreRpv(valorRpv: number, percentual: number): ResultadoRpv {
  if (!(valorRpv >= 0)) throw new Error('Valor da RPV inválido.');
  if (!(percentual >= 0 && percentual <= 100)) throw new Error('Percentual deve estar entre 0 e 100.');
  const centavos = Math.round(valorRpv * 100);
  const honorariosCent = Math.round((centavos * percentual) / 100);
  return {
    valorRpv: centavos / 100,
    percentual,
    honorarios: honorariosCent / 100,
    liquidoCliente: (centavos - honorariosCent) / 100,
  };
}

export function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
