// Datas sempre no formato "AAAA-MM-DD", calculadas em UTC para não sofrer com fuso horário.

export type DataISO = string;

export function parse(d: DataISO): Date {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia));
}

export function iso(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

export function hoje(): DataISO {
  const agora = new Date();
  return iso(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())));
}

export function somarDias(d: DataISO, n: number): DataISO {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
}

export function somarAnos(d: DataISO, n: number): DataISO {
  const x = parse(d);
  const dia = x.getUTCDate();
  x.setUTCFullYear(x.getUTCFullYear() + n);
  // 29/02 + 1 ano vira 28/02, não 01/03
  if (x.getUTCDate() !== dia) x.setUTCDate(0);
  return iso(x);
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((parse(ate).getTime() - parse(de).getTime()) / 86_400_000);
}

export function idade(nascimento: DataISO, em: DataISO): number {
  const n = parse(nascimento);
  const e = parse(em);
  let anos = e.getUTCFullYear() - n.getUTCFullYear();
  const antesDoAniversario =
    e.getUTCMonth() < n.getUTCMonth() ||
    (e.getUTCMonth() === n.getUTCMonth() && e.getUTCDate() < n.getUTCDate());
  if (antesDoAniversario) anos--;
  return anos;
}

export function diaDaSemana(d: DataISO): number {
  return parse(d).getUTCDay(); // 0 = domingo
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function formatar(d?: DataISO | null): string {
  if (!d) return '—';
  const [a, m, dia] = d.slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
}

export function formatarComSemana(d: DataISO): string {
  return `${formatar(d)} (${SEMANA[diaDaSemana(d)]})`;
}
