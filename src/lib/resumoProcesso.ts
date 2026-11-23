// Dados para o "Resumo Inteligente" do processo.
// Os pontos de atenção e a situação são calculados aqui (regras fixas, confiáveis); a IA só redige o texto.
// Por privacidade (LGPD), o que vai para a IA não tem nome, CPF nem telefone de ninguém: só dados do processo.

import type { Banco, Processo } from '../store';
import { DataISO, diasEntre, formatar, somarDias } from './datas';
import { faseAtual, indicadoresFicha, ROTULO_TIPO } from './etapas';
import { CLIENTE_A_IDENTIFICAR } from './importacao';
import { moeda } from './honorarios';
import { partesDoAssunto } from './processos';

export type SituacaoProcesso = 'ativo' | 'arquivado' | 'suspenso';

export const ROTULO_SITUACAO_PROCESSO: Record<SituacaoProcesso, string> = {
  ativo: 'Processo ativo',
  arquivado: 'Arquivado / baixado',
  suspenso: 'Suspenso',
};

/** Situação pelas movimentações mais recentes (arquivamento, baixa, suspensão). */
export function situacaoDoProcesso(p: Processo): SituacaoProcesso {
  const recentes = (p.movimentosOficiais || []).slice(0, 5).map((m) => `${m.nome} ${m.complemento || ''}`.toLowerCase());
  if (recentes.some((t) => /arquivad|arquivamento definitivo|baixa definitiva|transitado.*arquiv/.test(t))) return 'arquivado';
  if (recentes.slice(0, 2).some((t) => /suspens[aã]o|sobrestamento|sobrestad/.test(t))) return 'suspenso';
  return 'ativo';
}

/** Pontos de atenção do processo, calculados pelas regras do sistema. */
export function pontosDeAtencao(b: Banco, p: Processo, hoje: DataISO): string[] {
  const pts: string[] = [];
  const digitos = p.numero.replace(/\D/g, '');
  if (!p.responsavelId) pts.push('Processo sem responsável definido.');
  if (b.clientes.find((c) => c.id === p.clienteId)?.nome === CLIENTE_A_IDENTIFICAR) pts.push('Cliente ainda não identificado no cadastro.');
  if (!p.valor) pts.push('Valor da causa não informado.');

  const prazos = b.compromissos.filter((c) => c.processoId === p.id && c.status === 'pendente');
  const vencidos = prazos.filter((c) => c.data < hoje);
  const proximos = prazos.filter((c) => c.data >= hoje && c.data <= somarDias(hoje, 5)).sort((x, y) => x.data.localeCompare(y.data));
  if (vencidos.length) pts.push(`${vencidos.length} prazo(s) vencido(s) sem baixa.`);
  if (proximos.length) pts.push(`Prazo em ${formatar(proximos[0].data)}: ${proximos[0].titulo}.`);

  const aud = b.audiencias.filter((a) => a.processoId === p.id && a.data >= hoje).sort((x, y) => x.data.localeCompare(y.data))[0];
  if (aud) {
    const falta = !aud.clienteContatado || !aud.testemunhasConfirmadas;
    pts.push(`Audiência em ${formatar(aud.data)}${aud.hora ? ` às ${aud.hora}` : ''}${falta && diasEntre(hoje, aud.data) <= 7 ? ' — cliente ou testemunhas ainda sem contato' : ''}.`);
  }

  const tarefasAtrasadas = b.tarefas.filter((t) => t.processoId === p.id && t.coluna !== 'concluido' && t.prazo && t.prazo < hoje).length;
  if (tarefasAtrasadas) pts.push(`${tarefasAtrasadas} tarefa(s) atrasada(s).`);

  const intimacoes = b.intimacoes.filter((i) => i.status === 'nova' && i.processoNumero.replace(/\D/g, '') === digitos).length;
  if (intimacoes) pts.push(`${intimacoes} intimação(ões) sem tratar na Controladoria.`);

  const ind = indicadoresFicha(p.etapas, hoje, p.movimentosOficiais?.[0]?.data?.slice(0, 10));
  if ((ind.diasParado ?? 0) > 60 && situacaoDoProcesso(p) === 'ativo') pts.push(`Sem movimentação há ${ind.diasParado} dias.`);
  return pts;
}

export interface DadosResumo {
  numero: string;
  tipo: string;
  classe: string;
  assuntos: string[];
  valorDaCausa: string | null;
  fase: string;
  orgao: string;
  tribunal: string;
  desde: string | null;
  situacao: string;
  diasParado: number | null;
  etapas: { etapa: string; data: string; resultado?: string }[];
  ultimasMovimentacoes: { data: string; movimento: string }[];
  pontosDeAtencao: string[];
}

/** Monta o que vai para a IA: só dados do processo (sem nomes, CPF ou telefone). */
export function montarDadosResumo(b: Banco, p: Processo, hoje: DataISO): DadosResumo {
  const dj = p.dadosJudiciais;
  const { classe } = partesDoAssunto(p.assunto);
  const ind = indicadoresFicha(p.etapas, hoje, p.movimentosOficiais?.[0]?.data?.slice(0, 10));
  const entrada = [...p.etapas].sort((a, c) => a.data.localeCompare(c.data))[0]?.data;
  return {
    numero: p.numero,
    tipo: ROTULO_TIPO[p.tipo],
    classe: dj?.classe || classe,
    assuntos: dj?.assuntos?.length ? dj.assuntos : [],
    valorDaCausa: p.valor ? moeda(p.valor) : null,
    fase: faseAtual(p.etapas),
    orgao: dj?.orgao || p.regiao || '',
    tribunal: dj?.tribunal || '',
    desde: dj?.ajuizamento ? formatar(dj.ajuizamento.slice(0, 10)) : entrada ? formatar(entrada) : null,
    situacao: ROTULO_SITUACAO_PROCESSO[situacaoDoProcesso(p)],
    diasParado: ind.diasParado,
    etapas: [...p.etapas].sort((a, c) => a.data.localeCompare(c.data)).map((e) => ({ etapa: e.etapa, data: formatar(e.data), resultado: e.resultado })),
    // Só o nome do movimento: o texto das intimações traz nomes de pessoas
    ultimasMovimentacoes: (p.movimentosOficiais || []).slice(0, 15).map((m) => ({
      data: formatar(String(m.data).slice(0, 10)),
      movimento: / no DJEN/.test(m.nome) ? m.nome : [m.nome, m.complemento].filter(Boolean).join(' — ').slice(0, 160),
    })),
    pontosDeAtencao: pontosDeAtencao(b, p, hoje),
  };
}

/** "**negrito**" do texto da IA em pedaços para a tela. */
export function partesNegrito(texto: string): { t: string; negrito: boolean }[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((t) => (t.startsWith('**') && t.endsWith('**') ? { t: t.slice(2, -2), negrito: true } : { t, negrito: false }));
}
