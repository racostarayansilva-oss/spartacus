// Central do WhatsApp: classificação das mensagens, resposta pronta e alarmes de protocolo.

export type CategoriaMensagem = 'andamento' | 'protocolo' | 'documentos' | 'audiencia' | 'outros';

export const ROTULO_CATEGORIA: Record<CategoriaMensagem, string> = {
  andamento: 'Consulta de andamento',
  protocolo: 'Pedido de protocolo',
  documentos: 'Envio de documentos',
  audiencia: 'Audiência',
  outros: 'Outros',
};

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// A ordem importa: a primeira regra que bater define a categoria.
const REGRAS: [CategoriaMensagem, RegExp][] = [
  ['protocolo', /\bprotocol|da entrada|dar entrada|der entrada|entra com o pedido/],
  ['audiencia', /audiencia|testemunha|pericia|\bjuiz\b|\bforum\b/],
  ['documentos', /document|\bsegue\b|seguem|enviei|mandei|em anexo|\banexo|\bfoto|comprovante|\brg\b|\bcpf\b|certidao|declaracao|\bcnis\b|cadunico|carteira de trabalho/],
  ['andamento', /como (anda|esta|ta|vai)|noticia|novidade|verific|andamento|\bandou\b|meu processo|minha aposentadoria|meu beneficio|saiu (o|a|alguma)|alguma (coisa|resposta)|ja (saiu|tem)/],
];

export function classificar(texto: string, temAnexo = false): CategoriaMensagem {
  const t = normalizar(texto);
  for (const [cat, re] of REGRAS) if (re.test(t)) return cat;
  if (temAnexo) return 'documentos';
  return 'outros';
}

export interface DadosResposta {
  nomeCliente: string;
  numeroProcesso?: string;
  faseAtual?: string;
  ultimaMovimentacao?: { data: string; descricao: string };
  audiencia?: { data: string; hora?: string; local?: string };
  assinatura?: string;
}

const ASSINATURA_PADRAO = 'RA Costa Advocacia & Consultoria';

export function respostaPronta(cat: CategoriaMensagem, d: DadosResposta): string {
  const primeiroNome = d.nomeCliente.split(' ')[0];
  const assinatura = `\n\n— ${d.assinatura || ASSINATURA_PADRAO}`;
  const linhas: string[] = [`Olá, ${primeiroNome}! Tudo bem?`];

  if (cat === 'andamento' || cat === 'audiencia') {
    if (!d.numeroProcesso) {
      linhas.push('Ainda não localizamos seu processo pelo seu número de WhatsApp. Pode nos enviar seu CPF para conferirmos?');
    } else {
      linhas.push(`Seu processo ${d.numeroProcesso} está na fase: *${d.faseAtual || 'em andamento'}*.`);
      if (d.ultimaMovimentacao) linhas.push(`Última movimentação (${d.ultimaMovimentacao.data}): ${d.ultimaMovimentacao.descricao}.`);
      if (d.audiencia) {
        linhas.push(
          `Audiência marcada para ${d.audiencia.data}${d.audiencia.hora ? ' às ' + d.audiencia.hora : ''}${d.audiencia.local ? ', ' + d.audiencia.local : ''}. Leve documento com foto e avise suas testemunhas.`,
        );
      } else if (cat === 'audiencia') {
        linhas.push('Por enquanto não há audiência marcada. Assim que houver, avisaremos.');
      }
      linhas.push('Qualquer novidade, entraremos em contato.');
    }
  } else if (cat === 'protocolo') {
    linhas.push('Recebemos seu pedido de protocolo. Nossa equipe vai conferir os documentos e avisaremos assim que for protocolado.');
  } else if (cat === 'documentos') {
    linhas.push('Recebemos seus documentos. Vamos conferir e, se faltar algo, avisaremos por aqui.');
  } else {
    linhas.push('Recebemos sua mensagem e logo um de nossos atendentes vai responder.');
  }
  return linhas.join('\n') + assinatura;
}

export interface PedidoProtocoloBase {
  id: string;
  clienteId: string;
  corretorId?: string | null;
  vezes: number;
  situacao: 'pendente' | 'protocolado';
}

export interface Alarme {
  tipo: 'repetido' | 'dois_corretores';
  clienteId: string;
  corretorIds: string[];
  vezes: number;
  texto: string;
}

/** Alarmes: mesmo corretor pedindo o mesmo protocolo várias vezes; mesma cliente enviada por corretores diferentes. */
export function alarmesProtocolo(
  pedidos: PedidoProtocoloBase[],
  nomeCliente: (id: string) => string,
  nomeCorretor: (id: string) => string,
): Alarme[] {
  const alarmes: Alarme[] = [];
  const pendentes = pedidos.filter((p) => p.situacao === 'pendente');

  for (const p of pendentes) {
    if (p.corretorId && p.vezes > 1) {
      alarmes.push({
        tipo: 'repetido',
        clienteId: p.clienteId,
        corretorIds: [p.corretorId],
        vezes: p.vezes,
        texto: `${nomeCorretor(p.corretorId)} pediu ${p.vezes}x o protocolo de ${nomeCliente(p.clienteId)}`,
      });
    }
  }

  const porCliente = new Map<string, Set<string>>();
  for (const p of pedidos) {
    if (!p.corretorId) continue;
    if (!porCliente.has(p.clienteId)) porCliente.set(p.clienteId, new Set());
    porCliente.get(p.clienteId)!.add(p.corretorId);
  }
  for (const [clienteId, corretores] of porCliente) {
    if (corretores.size > 1) {
      const ids = [...corretores];
      alarmes.push({
        tipo: 'dois_corretores',
        clienteId,
        corretorIds: ids,
        vezes: ids.length,
        texto: `${nomeCliente(clienteId)} foi enviada por ${ids.length} corretores: ${ids.map(nomeCorretor).join(' e ')}`,
      });
    }
  }
  return alarmes;
}
