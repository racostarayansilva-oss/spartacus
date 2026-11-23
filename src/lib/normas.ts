// Fichas de consulta rápida. O texto oficial vem do normas.leg.br pelo botão "Ver texto da lei".
// Resumos são orientativos; sempre confira o texto vigente.

export type AreaNorma = 'INSS' | 'Previdenciário' | 'Assistencial' | 'CPC' | 'JEF';

export interface FichaNorma {
  id: string;
  area: AreaNorma;
  titulo: string;
  referencia: string;
  resumo: string;
  link: string;
  /** URN LexML usada no normas.leg.br */
  urn?: string;
  /** Dispositivo no normas.leg.br (sufixo depois de "!"), ex.: art48 */
  art?: string;
  atencao?: string;
}

export const URN = {
  L8213: 'urn:lex:br:federal:lei:1991-07-24;8213',
  LOAS: 'urn:lex:br:federal:lei:1993-12-07;8742',
  CPC: 'urn:lex:br:federal:lei:2015-03-16;13105',
  L10259: 'urn:lex:br:federal:lei:2001-07-12;10259',
  L9099: 'urn:lex:br:federal:lei:1995-09-26;9099',
  D3048: 'urn:lex:br:federal:decreto:1999-05-06;3048',
} as const;

const P = 'https://www.planalto.gov.br/ccivil_03/';
const LINK = {
  L8213: P + 'leis/l8213cons.htm',
  LOAS: P + 'leis/l8742.htm',
  CPC: P + '_ato2015-2018/2015/lei/l13105.htm',
  L10259: P + 'leis/leis_2001/l10259.htm',
  L9099: P + 'leis/l9099.htm',
  D3048: P + 'decreto/d3048.htm',
  SUMULAS_STJ: 'https://scon.stj.jus.br/SCON/sumstj/',
  INSS_IN: 'https://www.in.gov.br/',
};

export const FICHAS: FichaNorma[] = [
  // INSS
  {
    id: 'in128', area: 'INSS', titulo: 'IN PRES/INSS 128/2022 — norma geral',
    referencia: 'IN PRES/INSS nº 128/2022',
    resumo: 'Disciplina as regras, procedimentos e rotinas de reconhecimento de direitos do RGPS no INSS. É a norma geral de consulta para requerimentos administrativos.',
    link: LINK.INSS_IN,
  },
  {
    id: 'in212', area: 'INSS', titulo: 'IN 212/2026 — mudanças de 06/08/2026',
    referencia: 'IN PRES/INSS nº 212, de 06/08/2026',
    resumo: 'Exigência sem resposta em 30 dias pode encerrar o pedido sem análise de mérito; pensão ao filho nascido após o óbito; o Anexo III do auxílio-acidente passa a ser exemplificativo; regras para o advogado procurador.',
    link: LINK.INSS_IN,
    atencao: 'Trate toda exigência do INSS como prazo de 30 dias na agenda.',
  },
  {
    id: 'd3048-305', area: 'INSS', titulo: 'Recurso ao CRPS em 30 dias',
    referencia: 'Decreto 3.048/99, art. 305',
    resumo: 'Das decisões do INSS cabe recurso ao Conselho de Recursos da Previdência Social (CRPS). Prazo de 30 dias para recorrer e para contrarrazões.',
    link: LINK.D3048, urn: URN.D3048, art: 'art305',
  },
  // Previdenciário — Lei 8.213/91
  {
    id: 'l8213-11', area: 'Previdenciário', titulo: 'Segurado especial',
    referencia: 'Lei 8.213/91, art. 11, VII',
    resumo: 'Segurado especial: produtor rural, pescador artesanal e assemelhados que trabalham individualmente ou em regime de economia familiar, com ou sem auxílio eventual de terceiros, incluindo cônjuge/companheiro e filhos maiores de 16 anos que trabalhem com o grupo familiar.',
    link: LINK.L8213, urn: URN.L8213, art: 'art11',
  },
  {
    id: 'l8213-48', area: 'Previdenciário', titulo: 'Aposentadoria por idade rural (55/60)',
    referencia: 'Lei 8.213/91, art. 48, §§1º e 2º',
    resumo: 'Para o trabalhador rural a idade é reduzida em 5 anos: 60 anos (homem) e 55 anos (mulher). Exige atividade rural, ainda que descontínua, no período imediatamente anterior ao requerimento, por tempo igual à carência (180 meses).',
    link: LINK.L8213, urn: URN.L8213, art: 'art48',
  },
  {
    id: 'l8213-39', area: 'Previdenciário', titulo: 'Salário-maternidade da segurada especial',
    referencia: 'Lei 8.213/91, art. 39, parágrafo único',
    resumo: 'Garante à segurada especial o salário-maternidade de um salário mínimo, mediante comprovação da atividade rural nos meses anteriores ao início do benefício.',
    link: LINK.L8213, urn: URN.L8213, art: 'art39',
    atencao: 'Depois das ADIs 2110 e 2111 (STF) a carência do salário-maternidade mudou. Confirme a regra atual da IN para a segurada especial.',
  },
  {
    id: 'l8213-71', area: 'Previdenciário', titulo: 'Salário-maternidade — duração',
    referencia: 'Lei 8.213/91, art. 71',
    resumo: 'Devido por 120 dias, com início entre 28 dias antes do parto e a data do parto.',
    link: LINK.L8213, urn: URN.L8213, art: 'art71',
    atencao: 'Ver ponto de atenção das ADIs 2110 e 2111 sobre carência.',
  },
  {
    id: 'l8213-55', area: 'Previdenciário', titulo: 'Início de prova material + Súmula 149 STJ',
    referencia: 'Lei 8.213/91, art. 55, §3º; Súmula 149/STJ',
    resumo: 'A comprovação de tempo de serviço exige início de prova material; não vale prova só testemunhal, salvo força maior ou caso fortuito. Súmula 149/STJ: a prova exclusivamente testemunhal não basta para comprovar a atividade rurícola.',
    link: LINK.L8213, urn: URN.L8213, art: 'art55',
  },
  {
    id: 'stj-577', area: 'Previdenciário', titulo: 'Súmula 577 do STJ',
    referencia: 'Súmula 577/STJ',
    resumo: 'É possível reconhecer o tempo de serviço rural anterior ao documento mais antigo apresentado, desde que amparado em convincente prova testemunhal colhida sob o contraditório.',
    link: LINK.SUMULAS_STJ,
  },
  {
    id: 'l8213-106', area: 'Previdenciário', titulo: 'Autodeclaração do segurado especial',
    referencia: 'Lei 8.213/91, art. 106',
    resumo: 'A atividade rural do segurado especial é comprovada por autodeclaração ratificada por entidades públicas credenciadas e por bases governamentais (CNIS), além dos documentos listados no artigo.',
    link: LINK.L8213, urn: URN.L8213, art: 'art106',
  },
  {
    id: 'l8213-74', area: 'Previdenciário', titulo: 'Pensão por morte — 90/180 dias',
    referencia: 'Lei 8.213/91, art. 74',
    resumo: 'A pensão é devida desde o óbito se requerida em até 180 dias (filhos menores de 16 anos) ou 90 dias (demais dependentes); depois disso, desde o requerimento.',
    link: LINK.L8213, urn: URN.L8213, art: 'art74',
  },
  {
    id: 'l8213-103', area: 'Previdenciário', titulo: 'Decadência e prescrição',
    referencia: 'Lei 8.213/91, art. 103',
    resumo: 'Decadência de 10 anos para revisar o ato de concessão ou indeferimento. Parágrafo único: prescrevem em 5 anos as prestações vencidas.',
    link: LINK.L8213, urn: URN.L8213, art: 'art103',
  },
  // Assistencial
  {
    id: 'loas-20', area: 'Assistencial', titulo: 'BPC/LOAS — idoso e pessoa com deficiência',
    referencia: 'Lei 8.742/93, art. 20',
    resumo: 'Benefício de um salário mínimo à pessoa com deficiência e ao idoso com 65 anos ou mais sem meios de prover a própria manutenção. Critério de renda familiar per capita de até 1/4 do salário mínimo, com flexibilização prevista em lei e na jurisprudência do STF.',
    link: LINK.LOAS, urn: URN.LOAS, art: 'art20',
  },
  // CPC
  {
    id: 'cpc-219', area: 'CPC', titulo: 'Contagem em dias úteis',
    referencia: 'CPC, art. 219',
    resumo: 'Na contagem de prazo em dias, computam-se só os dias úteis. Vale apenas para prazos processuais.',
    link: LINK.CPC, urn: URN.CPC, art: 'art219',
  },
  {
    id: 'cpc-220', area: 'CPC', titulo: 'Recesso de 20/12 a 20/01',
    referencia: 'CPC, art. 220',
    resumo: 'Suspende-se o curso dos prazos processuais entre 20 de dezembro e 20 de janeiro, inclusive.',
    link: LINK.CPC, urn: URN.CPC, art: 'art220',
  },
  {
    id: 'cpc-224', area: 'CPC', titulo: 'Início da contagem e publicação no DJe',
    referencia: 'CPC, art. 224, §§2º e 3º',
    resumo: 'Exclui o dia do começo e inclui o do vencimento. Considera-se publicada a decisão no 1º dia útil seguinte à disponibilização no DJe, e o prazo começa no 1º dia útil seguinte à publicação.',
    link: LINK.CPC, urn: URN.CPC, art: 'art224',
  },
  {
    id: 'cpc-1003', area: 'CPC', titulo: 'Recursos em 15 dias; embargos em 5',
    referencia: 'CPC, arts. 1.003, §5º e 1.023',
    resumo: 'Prazo de 15 dias para interpor recursos e responder, exceto embargos de declaração, que têm prazo de 5 dias.',
    link: LINK.CPC, urn: URN.CPC, art: 'art1003',
  },
  {
    id: 'cpc-335', area: 'CPC', titulo: 'Contestação',
    referencia: 'CPC, art. 335',
    resumo: 'O réu pode contestar em 15 dias, contados conforme as hipóteses do artigo (audiência de conciliação, protocolo do pedido de cancelamento, citação).',
    link: LINK.CPC, urn: URN.CPC, art: 'art335',
  },
  {
    id: 'cpc-485', area: 'CPC', titulo: 'Extinção sem mérito e nova ação',
    referencia: 'CPC, arts. 485 e 486',
    resumo: 'Hipóteses em que o juiz não resolve o mérito. Em regra, isso não impede que a parte proponha a ação de novo (art. 486).',
    link: LINK.CPC, urn: URN.CPC, art: 'art485',
  },
  {
    id: 'cpc-487', area: 'CPC', titulo: 'Resolução de mérito',
    referencia: 'CPC, art. 487',
    resumo: 'Há resolução de mérito quando o juiz acolhe ou rejeita o pedido, decide sobre decadência ou prescrição, ou homologa reconhecimento, transação ou renúncia.',
    link: LINK.CPC, urn: URN.CPC, art: 'art487',
  },
  {
    id: 'cpc-98', area: 'CPC', titulo: 'Gratuidade da justiça',
    referencia: 'CPC, arts. 98 e 99',
    resumo: 'Direito à gratuidade para quem não tem recursos para pagar custas e honorários. Presume-se verdadeira a alegação de insuficiência feita por pessoa natural (art. 99, §3º).',
    link: LINK.CPC, urn: URN.CPC, art: 'art98',
  },
  {
    id: 'cpc-300', area: 'CPC', titulo: 'Tutela de urgência',
    referencia: 'CPC, art. 300',
    resumo: 'Concedida quando houver elementos que evidenciem a probabilidade do direito e o perigo de dano ou o risco ao resultado útil do processo.',
    link: LINK.CPC, urn: URN.CPC, art: 'art300',
  },
  // JEF
  {
    id: 'l10259', area: 'JEF', titulo: 'JEF: até 60 salários mínimos; RPV em 60 dias',
    referencia: 'Lei 10.259/01, arts. 3º e 17',
    resumo: 'Compete ao JEF Cível processar causas da Justiça Federal até 60 salários mínimos (art. 3º). A obrigação de pagar quantia certa até esse limite é paga por RPV em 60 dias da entrega da requisição (art. 17).',
    link: LINK.L10259, urn: URN.L10259, art: 'art3',
  },
  {
    id: 'l9099', area: 'JEF', titulo: 'Dias úteis e recurso inominado em 10 dias',
    referencia: 'Lei 9.099/95, arts. 12-A e 42',
    resumo: 'Nos juizados, os prazos em dias contam só dias úteis (art. 12-A). O recurso contra a sentença é interposto em 10 dias, contados da ciência (art. 42).',
    link: LINK.L9099, urn: URN.L9099, art: 'art42',
  },
];

export function buscarFichas(termo: string, area?: AreaNorma | ''): FichaNorma[] {
  const t = termo.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return FICHAS.filter((f) => {
    if (area && f.area !== area) return false;
    if (!t) return true;
    const alvo = `${f.titulo} ${f.referencia} ${f.resumo} ${f.atencao || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return t.split(/\s+/).every((p) => alvo.includes(p));
  });
}
