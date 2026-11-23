// Indicadores do CNIS: descrição oficial do INSS e o que fazer no escritório.
// Fonte das descrições: Manual de Indicadores do CNIS (INSS), atualizado até 11/2026.

export type TipoIndicador = 'pendencia' | 'indicador' | 'acerto';
export type GrupoIndicador = 'Vínculos e remunerações' | 'Contribuições' | 'Ajustes da EC 103';

export type IndicadorCnis = {
  sigla: string;
  tipo: TipoIndicador;
  grupo: GrupoIndicador;
  descricao: string;
  significa: string;
  fazer: string[];
  conta: 'nao' | 'sim' | 'depende';
};

export const ROTULO_TIPO: Record<TipoIndicador, string> = { pendencia: 'Pendência', indicador: 'Indicador', acerto: 'Acerto' };
export const ROTULO_CONTA: Record<IndicadorCnis['conta'], string> = { nao: 'Não conta até resolver', sim: 'Conta normalmente', depende: 'Depende do caso' };

export const INDICADORES: IndicadorCnis[] = [
  {
    sigla: 'PEXT', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Vínculo com informação extemporânea, passível de comprovação',
    significa: 'O vínculo, ou parte dele, foi informado ao CNIS fora do prazo legal (art. 19, § 3º, do Decreto 3.048/1999). Sem comprovação, o período não entra no tempo de contribuição nem no cálculo da renda.',
    fazer: ['Pedir ao cliente CTPS, ficha de registro, contrato, TRCT, extrato do FGTS e holerites do período.', 'Requerer o acerto de vínculo extemporâneo no Meu INSS (ou na própria DER do benefício).', 'Se negado, levar ao JEF: CTPS sem rasura tem presunção de veracidade (Súmula 75 da TNU).'],
  },
  {
    sigla: 'AEXT-VT', tipo: 'acerto', grupo: 'Vínculos e remunerações', conta: 'sim',
    descricao: 'Vínculo extemporâneo confirmado pelo INSS',
    significa: 'O pedido de acerto do vínculo extemporâneo foi totalmente deferido. O período já conta para carência, tempo e cálculo.',
    fazer: ['Nada a fazer. Só conferir se os salários do período estão corretos.'],
  },
  {
    sigla: 'AEXT-IND', tipo: 'acerto', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Vínculo extemporâneo não confirmado pelo INSS',
    significa: 'O pedido de acerto do vínculo extemporâneo foi indeferido. O período continua fora da contagem.',
    fazer: ['Obter a decisão e o motivo do indeferimento.', 'Reforçar a prova material (FGTS, holerites, recibos, documentos da empresa).', 'Recurso administrativo ou ação no JEF.'],
  },
  {
    sigla: 'AEXT-VI', tipo: 'acerto', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Vínculo extemporâneo não confirmado pelo INSS (sigla antiga)',
    significa: 'Mesma situação do AEXT-IND, com a nomenclatura usada antes de 2024: o acerto do vínculo extemporâneo foi indeferido.',
    fazer: ['Tratar como AEXT-IND: entender o motivo, reforçar a prova e recorrer ou ajuizar.'],
  },
  {
    sigla: 'AVRC-DEF', tipo: 'acerto', grupo: 'Vínculos e remunerações', conta: 'sim',
    descricao: 'Acerto confirmado pelo INSS',
    significa: 'O requerimento de acerto de vínculo foi deferido pelo INSS.',
    fazer: ['Conferir se o acerto saiu como pedido (datas e remunerações).'],
  },
  {
    sigla: 'PREM-EXT', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Remuneração informada fora do prazo, passível de comprovação',
    significa: 'Contribuinte individual que presta serviço a empresa (a partir de 04/2003): a empresa informou a remuneração fora do prazo. Sem tratamento, o mês não conta.',
    fazer: ['Juntar recibos (RPA), notas, contrato de prestação de serviço e declaração da empresa.', 'Pedir o acerto no Meu INSS, com base no art. 29-A da Lei 8.213/1991.'],
  },
  {
    sigla: 'PREM-FVIN', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Remuneração após o fim do vínculo',
    significa: 'Há salários informados depois da data de saída do vínculo. Esses meses não contam por estarem fora do período do contrato. Costuma ser erro na data de rescisão.',
    fazer: ['Conferir a data de saída na CTPS e no TRCT.', 'Se a data estiver errada no CNIS, pedir a retificação do fim do vínculo com os documentos.'],
  },
  {
    sigla: 'PREM-PER-DESLIG-JUD', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Remuneração após desligamento reconhecido judicialmente',
    significa: 'Uma decisão judicial fixou o desligamento antes de remunerações já informadas no eSocial. Não há tratamento no INSS para validar esses meses.',
    fazer: ['Orientar o empregador a corrigir os dados no eSocial.'],
  },
  {
    sigla: 'IREM-PER-QUARENTENA', tipo: 'indicador', grupo: 'Vínculos e remunerações', conta: 'depende',
    descricao: 'Remuneração após o desligamento referente ao período de quarentena',
    significa: 'Remuneração paga entre o desligamento e o fim da quarentena (substituiu o antigo IREM-PERQRT).',
    fazer: ['Conferir com o cliente se houve quarentena remunerada e se as datas batem.'],
  },
  {
    sigla: 'IREM-INDPEND', tipo: 'indicador', grupo: 'Vínculos e remunerações', conta: 'depende',
    descricao: 'Remunerações com indicadores/pendência',
    significa: 'Aviso geral: alguma remuneração do vínculo tem indicador. Só o detalhamento mostra qual é e se precisa de tratamento.',
    fazer: ['Abrir o detalhamento das remunerações no CNIS e tratar o indicador específico de cada mês.'],
  },
  {
    sigla: 'IREM-ACD', tipo: 'indicador', grupo: 'Vínculos e remunerações', conta: 'sim',
    descricao: 'Remuneração possui parcela de acordo, convenção ou dissídio coletivo',
    significa: 'Parte da remuneração veio de acordo, convenção ou dissídio coletivo. Não depende de comprovação.',
    fazer: ['Nada a fazer.'],
  },
  {
    sigla: 'IEAN', tipo: 'indicador', grupo: 'Vínculos e remunerações', conta: 'depende',
    descricao: 'Exposição a agente nocivo informada pelo empregador, passível de comprovação',
    significa: 'O empregador declarou exposição a agente nocivo. Indica possível atividade especial, mas não converte o tempo sozinho.',
    fazer: ['Pedir PPP e LTCAT ao empregador.', 'Avaliar aposentadoria especial ou conversão do tempo especial (até 13/11/2019).'],
  },
  {
    sigla: 'PADM-EMPR', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'depende',
    descricao: 'Data de admissão incompatível com o período de atividade do empregador',
    significa: 'A admissão é anterior à abertura do CNPJ ou posterior ao seu encerramento. Comprovado o vínculo, ele conta normalmente.',
    fazer: ['Juntar CTPS, contrato social ou documentos da empresa que mostrem a atividade na época.', 'Pedir a validação do vínculo no INSS.'],
  },
  {
    sigla: 'PVIN-IRREG', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Vínculo em situação de irregularidade',
    significa: 'O vínculo foi marcado após apuração de indício de fraude. A irregularidade pode ser do empregador, não do segurado.',
    fazer: ['Levantar prova robusta do trabalho (CTPS, FGTS, holerites, testemunhas).', 'Pedir a desmarcação no INSS ou discutir no JEF.'],
  },
  {
    sigla: 'PRPPS', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'depende',
    descricao: 'Vínculo de empregado com informações de regime próprio (servidor público)',
    significa: 'Parte ou todo o vínculo é de regime próprio (RPPS). Esse tempo não entra no INSS automaticamente.',
    fazer: ['Pedir a CTC (Certidão de Tempo de Contribuição) ao órgão público.', 'Averbar a CTC no INSS, ou corrigir o regime no vínculo se o período era RGPS.'],
  },
  {
    sigla: 'PDT-NASC-FIL-INV', tipo: 'pendencia', grupo: 'Vínculos e remunerações', conta: 'nao',
    descricao: 'Idade do filiado menor que a permitida pela legislação',
    significa: 'Há vínculo ou contribuição em época em que o segurado não tinha a idade mínima (12, 14 ou 16 anos, conforme a época).',
    fazer: ['Conferir se a data de nascimento no CNIS está certa e corrigir se preciso.', 'Se o trabalho foi real, avaliar o reconhecimento do trabalho infantil na Justiça.'],
  },
  {
    sigla: 'PREC-MENOR-MIN', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Recolhimento abaixo do valor mínimo',
    significa: 'Contribuição de individual, facultativo ou segurado especial abaixo do mínimo da competência. Sem complementação, não conta para tempo, carência nem cálculo.',
    fazer: ['Emitir a guia de complementação da diferença e pagar.', 'O indicador sai sozinho depois do pagamento.'],
  },
  {
    sigla: 'PSC-MEN-SM-EC103', tipo: 'pendencia', grupo: 'Ajustes da EC 103', conta: 'nao',
    descricao: 'Salário de contribuição menor que o mínimo (a partir de 11/2019)',
    significa: 'Na competência, a soma dos salários ficou abaixo do salário mínimo. Pela EC 103/2019, o mês só conta após complementar, utilizar excedente ou agrupar competências.',
    fazer: ['Pedir no Meu INSS os "Ajustes da EC 103": complementação, utilização ou agrupamento.', 'Pagar o DARF de complementação, se for o caso.'],
  },
  {
    sigla: 'PREM-BLOQ-EC103', tipo: 'pendencia', grupo: 'Ajustes da EC 103', conta: 'nao',
    descricao: 'Remuneração bloqueada para ajuste entre competências',
    significa: 'A competência tem outra pendência (vínculo extemporâneo, plano simplificado sem complemento, CNPJ irregular etc.) que impede o ajuste da EC 103.',
    fazer: ['Resolver primeiro a outra pendência do mesmo mês.', 'Depois, o bloqueio cai e o ajuste pode ser pedido.'],
  },
  {
    sigla: 'IREC-INDPEND', tipo: 'indicador', grupo: 'Contribuições', conta: 'depende',
    descricao: 'Recolhimentos com indicadores/pendências',
    significa: 'Aviso geral: algum recolhimento do período tem indicador. É preciso detalhar mês a mês.',
    fazer: ['Abrir o detalhamento das contribuições e tratar o indicador específico.'],
  },
  {
    sigla: 'IRECOL', tipo: 'indicador', grupo: 'Contribuições', conta: 'sim',
    descricao: 'A contribuição da competência é recolhimento',
    significa: 'Só informa que o mês foi pago por guia (ex.: GPS).',
    fazer: ['Nada a fazer.'],
  },
  {
    sigla: 'IREC-LC123', tipo: 'indicador', grupo: 'Contribuições', conta: 'depende',
    descricao: 'Recolhimento no Plano Simplificado de Previdência (LC 123/2006)',
    significa: 'Pago com alíquota reduzida (11% ou 5%). Conta para aposentadoria por idade, mas não para aposentadoria por tempo de contribuição nem para CTC sem complementar até 20%.',
    fazer: ['Se o cliente precisa do período para tempo de contribuição, complementar até 20% com juros e multa.'],
  },
  {
    sigla: 'IREC-LC123-SUP', tipo: 'indicador', grupo: 'Contribuições', conta: 'depende',
    descricao: 'Recolhimento no Plano Simplificado acima do salário mínimo',
    significa: 'O valor pago no plano simplificado passou do limite. O salário de contribuição fica limitado ao mínimo.',
    fazer: ['Se quiser, pedir à Receita a restituição do excedente (observada a prescrição).'],
  },
  {
    sigla: 'IREC-MEI', tipo: 'indicador', grupo: 'Contribuições', conta: 'depende',
    descricao: 'Contribuição recolhida com código de MEI',
    significa: 'Pago como microempreendedor individual (5%). Não conta para tempo de contribuição nem CTC sem complementar até 20%.',
    fazer: ['Complementar a alíquota se o período for necessário para tempo de contribuição.'],
  },
  {
    sigla: 'PREC-FBR', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Recolhimento de facultativo de baixa renda não validado',
    significa: 'Contribuições de 5% como facultativo de baixa renda que não passaram na validação (CadÚnico desatualizado, renda própria, outra atividade etc.).',
    fazer: ['Conferir o CadÚnico do cliente (atualizado nos últimos 2 anos, renda familiar até 2 salários mínimos).', 'Atualizar o CadÚnico e pedir a validação, ou complementar para 11%/20%.'],
  },
  {
    sigla: 'IREC-FBR', tipo: 'indicador', grupo: 'Contribuições', conta: 'sim',
    descricao: 'Recolhimento de facultativo de baixa renda (Lei 12.470/2011) validado',
    significa: 'As contribuições de 5% como facultativo de baixa renda já foram validadas.',
    fazer: ['Nada a fazer.'],
  },
  {
    sigla: 'PREC-FACULTCONC', tipo: 'pendencia', grupo: 'Contribuições', conta: 'depende',
    descricao: 'Recolhimento de facultativo concomitante com outros vínculos',
    significa: 'Contribuiu como facultativo no mesmo período de um vínculo obrigatório. Se o vínculo estiver correto, o pagamento facultativo é indevido; se o vínculo estiver sem data de saída ou com código errado, é preciso ajustar.',
    fazer: ['Conferir se há vínculo "aberto" sem data de rescisão.', 'Corrigir a data de saída ou o código de pagamento no INSS.'],
  },
  {
    sigla: 'PREC-CSE', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Recolhimento de segurado especial pendente de comprovação da atividade',
    significa: 'Contribuição como segurado especial que só vale depois de ratificada a atividade rural ou de pesca no CNIS.',
    fazer: ['Juntar a autodeclaração do segurado especial e as provas da atividade rural.', 'Pedir a ratificação no INSS, ou a troca do código para outra categoria.'],
  },
  {
    sigla: 'PREC-PMIG-DOM', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Recolhimento de empregado doméstico sem comprovação de vínculo',
    significa: 'Há guias de doméstico, mas o vínculo correspondente não está no CNIS (ou está extemporâneo).',
    fazer: ['Juntar a CTPS com o vínculo doméstico.', 'Pedir a inclusão do vínculo no INSS: com isso, a pendência das guias cai.'],
  },
  {
    sigla: 'PREC-LC150-DOM', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Guia de doméstico paga em GPS a partir de 10/2015',
    significa: 'Desde 10/2015 o doméstico recolhe pelo eSocial (DAE). Guias GPS pagas depois disso não valem.',
    fazer: ['Regularizar o vínculo e as remunerações no eSocial.', 'Pedir à Receita a restituição das GPS pagas indevidamente.'],
  },
  {
    sigla: 'PREC-COD1821', tipo: 'pendencia', grupo: 'Contribuições', conta: 'nao',
    descricao: 'Recolhimento com código 1821 (mandato eletivo) sem a contribuição devida',
    significa: 'Mandato eletivo de 02/1998 a 09/2004 sem o valor da contribuição exigido pela IN 128/2022.',
    fazer: ['Pedir a inclusão dos valores pelo 135 ("Atualizar vínculos, remunerações e código de pagamento").'],
  },
];

const MAPA = new Map(INDICADORES.map((i) => [i.sigla, i]));
export const indicador = (sigla: string) => MAPA.get(sigla.toUpperCase());

// Encontra, num CNIS colado como texto, as siglas conhecidas e quantas vezes cada uma aparece.
export function detectar(texto: string): { ind: IndicadorCnis; vezes: number }[] {
  const t = texto.toUpperCase();
  const achados: { ind: IndicadorCnis; vezes: number }[] = [];
  for (const ind of INDICADORES) {
    const esc = ind.sigla.replace(/[-]/g, '\\-');
    const vezes = (t.match(new RegExp(`(?<![A-Z0-9-])${esc}(?![A-Z0-9-])`, 'g')) ?? []).length;
    if (vezes) achados.push({ ind, vezes });
  }
  const ordem: Record<IndicadorCnis['conta'], number> = { nao: 0, depende: 1, sim: 2 };
  return achados.sort((a, b) => ordem[a.ind.conta] - ordem[b.ind.conta] || b.vezes - a.vezes);
}
