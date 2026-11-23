// Planilha dos processos (Processos → Exportar Excel).
import type { Banco, Processo } from '../store';
import { faseAtual, ROTULO_TIPO } from './etapas';
import { ROTULO_SITUACAO_RPV } from './execucoes';
import { Aba } from './xlsx';

const dataBr = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const FASE_LEGIS = { instrucao: 'Instrução', recursal: 'Recursal', execucao: 'Execução' } as const;

export function abaProcessos(b: Banco, processos: Processo[], ultimaMovimentacao: (p: Processo) => string): Aba {
  const clientes = new Map(b.clientes.map((c) => [c.id, c]));
  const usuarios = new Map(b.usuarios.map((u) => [u.id, u.nome]));
  const corretores = new Map(b.corretores.map((k) => [k.id, k.nome]));
  const etiquetas = new Map((b.config.etiquetas || []).map((e) => [e.id, e.nome]));
  const cab = [
    'Número', 'Cliente', 'CPF', 'Telefone', 'Tipo', 'Assunto', 'Fase', 'Fase no Legis', 'Órgão / região', 'Responsável', 'Corretor',
    'Etiquetas', 'Valor da causa', 'RPV', 'Situação da RPV', 'Honorários (%)', 'Entrada', 'Última movimentação',
  ];
  const linhas = processos.map((p) => {
    const c = clientes.get(p.clienteId);
    const entrada = [...p.etapas].sort((x, y) => x.data.localeCompare(y.data))[0]?.data;
    return [
      p.numero, c?.nome || '', c?.cpf || '', c?.telefone || '', ROTULO_TIPO[p.tipo] || p.tipo, p.assunto, faseAtual(p.etapas),
      p.faseLegis ? FASE_LEGIS[p.faseLegis] : '', p.regiao, usuarios.get(p.responsavelId) || '', (p.corretorId && corretores.get(p.corretorId)) || '',
      (p.etiquetas || []).map((id) => etiquetas.get(id)).filter(Boolean).join(', '),
      p.valor || null, p.rpv?.valor || null, p.rpv ? ROTULO_SITUACAO_RPV[p.rpv.situacao] : '', p.rpv ? (p.rpv.percentual ?? 30) : null,
      dataBr(entrada), dataBr(ultimaMovimentacao(p)),
    ];
  });
  return {
    nome: 'Processos', linhas: [cab, ...linhas], colunasMoeda: [12, 13],
    larguras: [27, 34, 15, 16, 10, 40, 20, 13, 30, 22, 22, 26, 16, 14, 30, 13, 12, 18],
  };
}
