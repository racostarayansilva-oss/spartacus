export function somenteDigitos(v: string): string {
  return (v || '').replace(/\D/g, '');
}

/** Valida o CPF pelos dois dígitos verificadores. */
export function cpfValido(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (qtd: number) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(cpf[i]) * (qtd + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

export function formatarCpf(valor: string): string {
  const c = somenteDigitos(valor).slice(0, 11);
  return c
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Esconde o meio do CPF para exibir em listas e registros: 123.***.***-09 */
export function mascararCpf(valor: string): string {
  const c = somenteDigitos(valor);
  if (c.length !== 11) return valor;
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
}
