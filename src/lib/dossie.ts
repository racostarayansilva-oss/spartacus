// Dossiê do cliente: documentos esperados por benefício, análise de idade mínima e saída
// em texto (mesmo formato do dossiê manual do escritório) ou em HTML para imprimir.

import type { Banco, Beneficio, Cliente, DocumentoDossie } from '../store';
import { formatarCpf } from './cpf';
import { DataISO, diasEntre, formatar, idade, somarAnos } from './datas';
import { CABECALHO, escaparHtml } from './modelos';
import { IDADE_BPC, IDADE_RURAL, Sexo } from './triagem';

const IDENTIDADE = 'RG e CPF';
const RESIDENCIA = 'Comprovante de residência';
const CTPS = 'Carteira de Trabalho (todas as páginas com anotação)';
const CNIS = 'CNIS atualizado';
const CERTIDAO = 'Certidão de nascimento ou casamento';
const RURAL = 'Documentos que comprovem atividade rural';
const LAUDOS = 'Laudos médicos (se tiver)';
const CADUNICO = 'CadÚnico atualizado';

export const BENEFICIOS: Record<Beneficio, { rotulo: string; documentos: string[] }> = {
  aposentadoria_rural: { rotulo: 'Aposentadoria por idade rural', documentos: [IDENTIDADE, CERTIDAO, RESIDENCIA, CTPS, CNIS, RURAL, 'Autodeclaração do segurado especial', LAUDOS] },
  aposentadoria_urbana: { rotulo: 'Aposentadoria por idade urbana', documentos: [IDENTIDADE, CERTIDAO, RESIDENCIA, CTPS, CNIS, 'Carnês ou guias de contribuição (se tiver)'] },
  aposentadoria_hibrida: { rotulo: 'Aposentadoria por idade híbrida', documentos: [IDENTIDADE, CERTIDAO, RESIDENCIA, CTPS, CNIS, RURAL, 'Carnês ou guias de contribuição (se tiver)'] },
  bpc_idoso: { rotulo: 'BPC/LOAS — idoso', documentos: [IDENTIDADE, RESIDENCIA, CADUNICO, 'Documentos de todos do grupo familiar', 'Comprovantes de renda da família'] },
  bpc_deficiente: { rotulo: 'BPC/LOAS — pessoa com deficiência', documentos: [IDENTIDADE, RESIDENCIA, CADUNICO, 'Documentos de todos do grupo familiar', 'Comprovantes de renda da família', 'Laudos, exames e receitas médicas (com CID)'] },
  maternidade: { rotulo: 'Salário-maternidade', documentos: [IDENTIDADE, 'Certidão de nascimento da criança', RESIDENCIA, CNIS, `${RURAL} (se rural)`] },
  incapacidade: { rotulo: 'Benefício por incapacidade', documentos: [IDENTIDADE, RESIDENCIA, CTPS, CNIS, 'Laudos, exames e receitas médicas (com CID)', 'Atestado de afastamento'] },
  pensao: { rotulo: 'Pensão por morte', documentos: [IDENTIDADE, 'Certidão de óbito', 'Certidão de casamento ou prova de união estável', 'Documentos do falecido (RG, CPF e Carteira de Trabalho)', 'CNIS do falecido'] },
  outro: { rotulo: 'Outro', documentos: [] },
};

export function documentosPadrao(beneficio: Beneficio | undefined, novoId: () => string): DocumentoDossie[] {
  return (beneficio ? BENEFICIOS[beneficio].documentos : []).map((nome) => ({ id: novoId(), nome, entregue: false }));
}

export const pendentes = (c: Pick<Cliente, 'documentos'>) => (c.documentos ?? []).filter((d) => !d.entregue);

const IDADE_URBANA: Record<Sexo, number> = { F: 62, M: 65 };

function idadeMinima(beneficio: Beneficio | undefined, sexo: Sexo | undefined): number | 'sem-sexo' | null {
  switch (beneficio) {
    case 'aposentadoria_rural': return sexo ? IDADE_RURAL[sexo] : 'sem-sexo';
    case 'aposentadoria_urbana':
    case 'aposentadoria_hibrida': return sexo ? IDADE_URBANA[sexo] : 'sem-sexo';
    case 'bpc_idoso': return IDADE_BPC;
    default: return null;
  }
}

/** "1 ano e 1 mês", "3 meses", "12 dias" */
export function tempoAte(de: DataISO, ate: DataISO): string {
  let meses = 0;
  while (somarMeses(de, meses + 1) <= ate) meses++;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (!anos && !resto) { const dias = diasEntre(de, ate); return `${dias} ${dias === 1 ? 'dia' : 'dias'}`; }
  const partes = [anos && `${anos} ${anos === 1 ? 'ano' : 'anos'}`, resto && `${resto} ${resto === 1 ? 'mês' : 'meses'}`].filter(Boolean);
  return partes.join(' e ');
}

function somarMeses(d: DataISO, n: number): DataISO {
  const [a, m, dia] = d.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export interface AnaliseIdade {
  idade: number;
  situacao: 'atingiu' | 'falta' | 'sem-sexo' | 'sem-requisito';
  idadeMinima?: number;
  completaEm?: DataISO;
  texto: string;
}

/** Idade hoje e, quando o benefício exige, quando a pessoa completa a idade mínima. */
export function analiseIdade(c: Pick<Cliente, 'nascimento' | 'sexo' | 'beneficio'>, referencia: DataISO): AnaliseIdade | null {
  if (!c.nascimento) return null;
  const atual = idade(c.nascimento, referencia);
  const minima = idadeMinima(c.beneficio, c.sexo);
  if (minima === null) return { idade: atual, situacao: 'sem-requisito', texto: `${atual} anos de idade.` };
  if (minima === 'sem-sexo') return { idade: atual, situacao: 'sem-sexo', texto: `${atual} anos de idade. Informe o sexo para calcular a idade mínima.` };
  const completaEm = somarAnos(c.nascimento, minima);
  if (completaEm <= referencia) {
    return { idade: atual, situacao: 'atingiu', idadeMinima: minima, completaEm, texto: `${atual} anos de idade: já tem a idade mínima de ${minima} anos desde ${formatar(completaEm)}.` };
  }
  return {
    idade: atual, situacao: 'falta', idadeMinima: minima, completaEm,
    texto: `Possui somente ${atual} anos de idade, portanto ainda não tem idade para requerer. Completa ${minima} anos em ${formatar(completaEm)} (faltam ${tempoAte(referencia, completaEm)}).`,
  };
}

const nomeCorretor = (b: Banco, id?: string | null) => b.corretores.find((k) => k.id === id)?.nome;
const cidadeUf = (c: Cliente) => [c.cidade, c.uf].filter(Boolean).join(' - ');

/** Texto no formato do dossiê manual (para colar no WhatsApp ou num arquivo). */
export function dossieTexto(b: Banco, c: Cliente, referencia: DataISO): string {
  const linhas: string[] = [`NOME: ${c.nome.toUpperCase()}`];
  if (c.cpf) linhas.push(`CPF: ${formatarCpf(c.cpf)}`);
  if (c.beneficio) linhas.push(BENEFICIOS[c.beneficio].rotulo.toUpperCase());
  if (cidadeUf(c)) linhas.push(`CIDADE: ${cidadeUf(c).toUpperCase()}`);
  const corretor = nomeCorretor(b, c.corretorId);
  if (corretor) linhas.push(`CORRETOR: ${corretor.toUpperCase()}`);
  if (c.nascimento) linhas.push(`DATA DE NASCIMENTO: ${formatar(c.nascimento)}`);
  if (c.telefone) linhas.push(`TELEFONE: ${c.telefone}`);

  const analise = analiseIdade(c, referencia);
  const obs = [
    ...(analise && analise.situacao !== 'sem-requisito' ? [`(${formatar(referencia)}) OBS: ${analise.texto.toUpperCase()}`] : []),
    ...[...(c.anotacoes ?? [])].sort((x, y) => x.data.localeCompare(y.data)).map((a) => `(${formatar(a.data)}) OBS: ${a.texto}`),
  ];
  if (obs.length) linhas.push('', ...obs);

  const faltam = pendentes(c);
  if (faltam.length) linhas.push('', 'DOCUMENTOS QUE ESTÃO FALTANDO:', ...faltam.map((d) => `${d.nome};`));
  return linhas.join('\n');
}

/** Corpo HTML do dossiê para imprimir/PDF (vai dentro de documentoHtml, com cabeçalho e marca d'água). */
export function dossieHtml(b: Banco, c: Cliente, referencia: DataISO): string {
  const e = escaparHtml;
  const linha = (rotulo: string, valor?: string) => `<tr><td style="width:32%"><b>${e(rotulo)}</b></td><td>${valor ? e(valor) : '<span class="lacuna">—</span>'}</td></tr>`;
  const endereco = [c.endereco, c.numero && `nº ${c.numero}`, c.bairro, cidadeUf(c), c.cep && `CEP ${c.cep}`].filter(Boolean).join(', ');
  const analise = analiseIdade(c, referencia);
  const anotacoes = [...(c.anotacoes ?? [])].sort((x, y) => x.data.localeCompare(y.data));
  const docs = c.documentos ?? [];
  return `${CABECALHO}
<h1>Dossiê do cliente</h1>
<table class="qualificacao">
${linha('Nome', c.nome)}
${linha('CPF', c.cpf ? formatarCpf(c.cpf) : '')}
${linha('RG', c.rg)}
${linha('Data de nascimento', c.nascimento ? `${formatar(c.nascimento)}${analise ? ` (${analise.idade} anos)` : ''}` : '')}
${linha('Telefone', c.telefone)}
${linha('Endereço', endereco)}
${linha('Benefício pretendido', c.beneficio ? BENEFICIOS[c.beneficio].rotulo : '')}
${linha('Corretor', nomeCorretor(b, c.corretorId))}
</table>
${analise && analise.situacao !== 'sem-requisito' ? `<p><b>(${formatar(referencia)}) OBS:</b> ${e(analise.texto)}</p>` : ''}
${anotacoes.map((a) => `<p><b>(${formatar(a.data)}) OBS:</b> ${e(a.texto)}</p>`).join('\n')}
${c.obs ? `<p><b>Observações gerais:</b> ${e(c.obs)}</p>` : ''}
${docs.length ? `<h2>Documentos</h2><table class="qualificacao">${docs.map((d) => `<tr><td>${e(d.nome)}</td><td style="width:22%;text-align:center">${d.entregue ? 'Entregue' : '<b>FALTANDO</b>'}</td></tr>`).join('')}</table>` : ''}
<p class="local-data" style="text-align:right">Emitido em ${formatar(referencia)}.</p>`;
}
