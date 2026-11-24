// Busca global da barra do topo: clientes (nome, CPF, telefone) e processos (número CNJ, assunto, nome do cliente).
import type { Banco } from '../store';
import { somenteDigitos } from './cpf';
import { normalizar } from './importacao';

export interface ResultadoBusca { tipo: 'cliente' | 'processo'; id: string; titulo: string; detalhe: string; rota: string }

export function buscarTudo(b: Pick<Banco, 'clientes' | 'processos'>, termo: string, limite = 8): ResultadoBusca[] {
  const q = normalizar(termo.trim());
  const dig = somenteDigitos(termo);
  if (q.length < 2 && dig.length < 3) return [];
  const nomes = new Map(b.clientes.map((c) => [c.id, c.nome]));
  const pontos: [number, ResultadoBusca][] = [];

  for (const c of b.clientes) {
    const nome = normalizar(c.nome);
    let p = 0;
    if (dig.length >= 3 && (somenteDigitos(c.cpf).includes(dig) || somenteDigitos(c.telefone).includes(dig))) p = 3;
    else if (nome.startsWith(q)) p = 4;
    else if (q.length >= 2 && nome.includes(q)) p = 2;
    if (p) pontos.push([p, { tipo: 'cliente', id: c.id, titulo: c.nome, detalhe: [c.cpf && `CPF ${mascararCpf(c.cpf)}`, c.cidade].filter(Boolean).join(' · ') || 'Cliente', rota: `/clientes?cliente=${c.id}` }]);
  }
  for (const pr of b.processos) {
    const cliente = nomes.get(pr.clienteId) || '';
    let p = 0;
    if (dig.length >= 5 && somenteDigitos(pr.numero).includes(dig)) p = 5;
    else if (q.length >= 3 && normalizar(pr.assunto).includes(q)) p = 1;
    else if (q.length >= 3 && normalizar(cliente).startsWith(q)) p = 1.5;
    if (p) pontos.push([p, { tipo: 'processo', id: pr.id, titulo: pr.numero || pr.assunto, detalhe: [cliente, pr.assunto].filter(Boolean).join(' · '), rota: `/processos/${pr.id}` }]);
  }
  return pontos.sort((a, b) => b[0] - a[0] || a[1].titulo.localeCompare(b[1].titulo)).slice(0, limite).map(([, r]) => r);
}

/** CPF com o meio escondido (LGPD na tela compartilhada): 123.***.***-09 */
export function mascararCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : d;
}
