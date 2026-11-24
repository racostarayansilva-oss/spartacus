// Modelos de documentos do escritório. Cada modelo é um texto com marcadores {{campo}} que o
// Robô Gerador preenche com os dados do cliente escolhido. O que ficar vazio aparece como
// "___________" no PDF, para a pessoa completar à mão depois de imprimir.

import { Cliente } from '../store';
import { formatarCpf } from './cpf';

export interface Modelo {
  id: string;
  nome: string;
  descricao: string;
  /** Conteúdo em HTML para impressão (gera PDF no Ctrl+P). */
  html: string;
}

/** Dados do escritório usados nos documentos (Configurações → Dados nos documentos e marca). */
export interface DadosEscritorioDoc {
  nome?: string;
  logo?: string;
  /** Telefones e e-mail do cabeçalho (uma informação por linha) */
  contato?: string;
  /** Qualificação do(s) advogado(s) outorgado(s)/contratado(s) */
  qualificacao?: string;
  /** Comarca do foro do contrato, ex.: "São Paulo/SP" */
  foro?: string;
}

export const CABECALHO = `<div class="cabecalho">
  <img src="{{escritorio_logo}}" alt="{{escritorio_nome}}" />
  <div class="contato">{{escritorio_contato}}</div>
</div>`;

const RODAPE = `<div class="rodape"></div>`;

const ASSINATURA_TESTEMUNHAS = `
<div class="linha-assinatura">______________________________________________</div>
<div class="legenda-assinatura">DECLARANTE</div>
<div class="testemunhas">
  <div>
    <div class="linha-assinatura">_______________________________</div>
    <div class="legenda-assinatura">1ª TESTEMUNHA<br/>CPF</div>
  </div>
  <div>
    <div class="linha-assinatura">_______________________________</div>
    <div class="legenda-assinatura">2ª TESTEMUNHA<br/>CPF</div>
  </div>
</div>`;

export const MODELOS: Modelo[] = [
  {
    id: 'hipossuficiencia',
    nome: 'Declaração de hipossuficiência',
    descricao: 'Justiça gratuita (Lei 1.060/50 e art. 98 do CPC).',
    html: `${CABECALHO}
<h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1>
<p>Eu, <b>{{nome}}</b>, inscrito(a) no CPF sob o nº <b>{{cpf}}</b>, portador(a) da cédula de identidade nº <b>{{rg}}</b>, residente e domiciliado(a) à <b>{{endereco}}</b>, nº <b>{{numero}}</b>, bairro <b>{{bairro}}</b>, cidade <b>{{cidade}}</b>, Estado <b>{{uf}}</b>, CEP <b>{{cep}}</b>, declaro, sob as penas da lei, que <b>não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família</b>, razão pela qual solicito os benefícios da justiça gratuita, nos termos da Lei nº 1.060/50 e do artigo 98 e seguintes do Código de Processo Civil.</p>
<p>DECLARO, ainda, estar ciente de que a falsidade desta declaração constitui crime previsto no artigo 299 do Código Penal Brasileiro.</p>
<p class="local-data">{{cidade}}, {{dia}} de {{mesExtenso}} de {{ano}}.</p>
<div class="linha-assinatura">______________________________________________</div>
<div class="legenda-assinatura">DECLARANTE</div>
${RODAPE}`,
  },
  {
    id: 'endereco',
    nome: 'Declaração de endereço',
    descricao: 'Comprovante de residência com duas testemunhas.',
    html: `${CABECALHO}
<h1>DECLARAÇÃO DE ENDEREÇO</h1>
<p>Eu, <b>{{nome}}</b>, inscrito(a) no CPF sob o nº <b>{{cpf}}</b>, portador(a) da cédula de identidade nº <b>{{rg}}</b>, residente e domiciliado(a) à <b>{{endereco}}</b>, nº <b>{{numero}}</b>, bairro <b>{{bairro}}</b>, cidade <b>{{cidade}}</b>, Estado <b>{{uf}}</b>, CEP <b>{{cep}}</b>.</p>
<p>DECLARO, sob as penas da lei, que resido no endereço acima mencionado, sendo este o meu endereço atual e verdadeiro.</p>
<p>DECLARO, ainda, estar ciente das penalidades previstas no artigo 299 do Código Penal Brasileiro, em caso de falsidade das informações aqui prestadas.</p>
<p class="local-data">{{cidade}}, {{dia}} de {{mesExtenso}} de {{ano}}.</p>
${ASSINATURA_TESTEMUNHAS}
${RODAPE}`,
  },
  {
    id: 'procuracao',
    nome: 'Procuração ad judicia et extra',
    descricao: 'Procuração geral + poderes específicos (art. 105 CPC).',
    html: `${CABECALHO}
<h1>PROCURAÇÃO</h1>
<table class="qualificacao">
  <tr><td colspan="4"><b>OUTORGANTE:</b> {{nome}}</td></tr>
  <tr><td><b>ESTADO CIVIL:</b> {{estadoCivil}}</td><td><b>RG:</b> {{rg}}</td><td colspan="2"><b>CPF:</b> {{cpf}}</td></tr>
  <tr><td><b>PROFISSÃO:</b> {{profissao}}</td><td colspan="3"><b>CONTATO:</b> {{telefone}}</td></tr>
  <tr><td colspan="4"><b>ENDEREÇO:</b> {{endereco}}, nº {{numero}}</td></tr>
  <tr><td><b>CIDADE:</b> {{cidade}}</td><td><b>CEP:</b> {{cep}}</td><td colspan="2"><b>BAIRRO:</b> {{bairro}}</td></tr>
</table>
<p><b>OUTORGADOS:</b> {{advogado_qualificacao}}</p>
<p><b>PODERES GERAIS:</b> O(a)(s) outorgante(s) confere(m) ao outorgado amplos poderes para o foro em geral, com a cláusula <i>"ad negotia"</i> assinar declarações e fazer provas de recursos perante os órgãos do Imposto de Renda; dando poderes específicos para receber e dar quitação e firmar, assinar declaração para confirmação de isenção de impostos de renda em nome do outorgado sacar RPV (Requisição de Pequeno Valor), nos termos do art. 661 parágrafo 1º do código civil, e <i>"ad judicia et extra"</i> para representá-lo em repartições públicas federais, municipais e estaduais, bem como em autarquias e especialmente perante o INSS – Instituto Nacional de Seguro Social, para tratar de assunto de seu interesse, assinando requerimentos e outros papéis, requerer benefícios previdenciários e suas revisões, transformações, obter vistas em procedimento administrativo, conferindo-lhes ainda poderes para, em qualquer juízo, Instância ou Tribunal propor ação revisional e/ou concessão de benefício, seguindo até o final, utilizando-se dos recursos legais e acompanhando-os, sendo expressamente autorizados a confessar, prestar depoimento pessoal, desistir, renunciar aos valores excedentes a 60 (sessenta) salários mínimos em razão do procedimento especial (art. da Lei 10.259/2001), além de transigir, firmar compromissos ou acordos, receber e dar quitação, levantar valores existentes em contas judiciais, precatórios, RPV deduzindo e compensando os seus créditos por despesas de verba honorária contratual, agindo tudo em conjunto ou separadamente, autorizado o substabelecimento com ou sem reserva de poderes. O(A) OUTORGANTE declara-se ciente de que a substituição do outorgado por outro profissional sem prévia comunicação ao escritório, bem como a desistência dos serviços contratados, implicará no pagamento de <b>multa de 30% (trinta por cento) sobre o valor total dos honorários contratados</b>, a título de indenização pelos serviços já prestados. Nos casos em que os valores devidos ao(à) OUTORGANTE sejam pagos por meio de Requisição de Pequeno Valor (RPV), fica desde já autorizado o levantamento, pelo(a) OUTORGADO(A), da parcela correspondente aos honorários advocatícios contratuais, diretamente junto ao juízo competente, independentemente de qualquer outra formalidade.</p>
<p><b>PODERES ESPECÍFICOS:</b> em conformidade com o art. 105 do CPC/2015: A presente procuração outorga ao advogado acima descrito, os poderes para, em nome do outorgante, receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber, dar quitação, firmar compromisso, pedir a justiça gratuita e assinar declaração de hipossuficiência econômica, solicitar informações a respeito das contribuições e vínculos empregatícios, requerer CNIS, reembolso contribuições previdenciárias, laudos, exames e avaliação médica e social, inclusive o SABI, tirar cópias, retirar em carga processo administrativo e documentos, requerer, revisar qualquer benefício previdenciário, recorrer, requerer informações, requerer a unificação de suas inscrições, averbar vínculos empregatícios, bem como cadastrar CADSENHA ou MEUINSS.</p>
<p class="local-data">{{cidade}}, {{dia}} de {{mesExtenso}} de {{ano}}.</p>
<div class="linha-assinatura">______________________________________________</div>
<div class="legenda-assinatura">OUTORGANTE</div>
<div class="testemunhas">
  <div><div class="linha-assinatura">_______________________________</div><div class="legenda-assinatura">1ª TESTEMUNHA<br/>CPF</div></div>
  <div><div class="linha-assinatura">_______________________________</div><div class="legenda-assinatura">2ª TESTEMUNHA<br/>CPF</div></div>
</div>
${RODAPE}`,
  },
  {
    id: 'procuracao-contrato',
    nome: 'Procuração + contrato de honorários',
    descricao: 'Procuração seguida do contrato de prestação de serviços advocatícios.',
    html: `${CABECALHO}
<h1>PROCURAÇÃO</h1>
<table class="qualificacao">
  <tr><td colspan="4"><b>OUTORGANTE:</b> {{nome}}</td></tr>
  <tr><td><b>ESTADO CIVIL:</b> {{estadoCivil}}</td><td><b>RG:</b> {{rg}}</td><td colspan="2"><b>CPF:</b> {{cpf}}</td></tr>
  <tr><td><b>PROFISSÃO:</b> {{profissao}}</td><td colspan="3"><b>CONTATO:</b> {{telefone}}</td></tr>
  <tr><td colspan="4"><b>ENDEREÇO:</b> {{endereco}}, nº {{numero}}</td></tr>
  <tr><td><b>CIDADE:</b> {{cidade}}</td><td><b>CEP:</b> {{cep}}</td><td colspan="2"><b>BAIRRO:</b> {{bairro}}</td></tr>
</table>
<p><b>OUTORGADOS:</b> {{advogado_qualificacao}}</p>
<p><b>PODERES GERAIS:</b> O(a)(s) outorgante(s) confere(m) ao outorgado amplos poderes para o foro em geral, com a cláusula <i>"ad negotia"</i>, incluindo poderes para representá-lo(a) perante repartições públicas federais, municipais e estaduais, especialmente perante o INSS, para tratar de assunto de seu interesse, requerer benefícios previdenciários e suas revisões, e para, em qualquer juízo, Instância ou Tribunal propor ações, seguindo até o final, com os poderes de "ad judicia et extra", autorizado o substabelecimento com ou sem reserva de poderes.</p>
<p><b>PODERES ESPECÍFICOS:</b> em conformidade com o art. 105 do CPC/2015: receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber, dar quitação, firmar compromisso, pedir a justiça gratuita e assinar declaração de hipossuficiência econômica.</p>
<p class="local-data">{{cidade}}, {{dia}} de {{mesExtenso}} de {{ano}}.</p>
<div class="linha-assinatura">______________________________________________</div>
<div class="legenda-assinatura">OUTORGANTE</div>
<div class="quebra-pagina"></div>
${CABECALHO}
<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>
<table class="qualificacao">
  <tr><td colspan="4"><b>CONTRATANTE:</b> {{nome}}</td></tr>
  <tr><td><b>ESTADO CIVIL:</b> {{estadoCivil}}</td><td><b>RG:</b> {{rg}}</td><td colspan="2"><b>CPF:</b> {{cpf}}</td></tr>
  <tr><td><b>PROFISSÃO:</b> {{profissao}}</td><td colspan="3"><b>CONTATO:</b> {{telefone}}</td></tr>
  <tr><td colspan="4"><b>ENDEREÇO:</b> {{endereco}}, nº {{numero}}</td></tr>
  <tr><td><b>CIDADE:</b> {{cidade}}</td><td><b>CEP:</b> {{cep}}</td><td colspan="2"><b>BAIRRO:</b> {{bairro}}</td></tr>
</table>
<p><b>CONTRATADO:</b> {{advogado_qualificacao}}</p>
<p><b>Cláusula 1ª - DO OBJETO:</b> O objeto do presente contrato é a prestação de serviços advocatícios pelo CONTRATADO. Para consecução dos referidos serviços, o(a) CONTRATANTE se obriga a outorgar procuração ao CONTRATADO. As atividades inclusas na prestação de serviço são todas aquelas inerentes à profissão: praticar todos os atos inerentes ao exercício da advocacia e aqueles constantes no Estatuto da OAB, bem como os especificados no Instrumento Procuratório.</p>
<p><b>Cláusula 2ª - DOS HONORÁRIOS:</b> Pela prestação dos serviços, o(a) CONTRATANTE pagará ao CONTRATADO o equivalente a <b>{{honorarios}}</b> a título de honorários contratuais. Não se compreendem nessas quantias as despesas judiciais ou extras (perícia, cálculo, viagens etc.).</p>
<p><b>Cláusula 3ª - DAS GARANTIAS:</b> O CONTRATANTE declara-se ciente de que o presente contrato é de meio, na via judicial.</p>
<p><b>Cláusula 4ª - DAS OBRIGAÇÕES DA CONTRATANTE:</b> O CONTRATANTE deverá fornecer ao CONTRATADO os documentos e informações necessárias ao bom e rápido andamento do processo, dentro dos prazos legais.</p>
<p><b>Cláusula 5ª - DA RESCISÃO:</b> A substituição do CONTRATADO por outro profissional sem prévia comunicação ao escritório, bem como a desistência do CONTRATANTE dos serviços contratados, implicará em rescisão unilateral do presente contrato, ficando o CONTRATANTE obrigado(a) ao pagamento imediato de <b>multa de 30% (trinta por cento) sobre o valor total dos honorários contratados</b>. Nos casos em que o pagamento se der por RPV, fica autorizado o levantamento, pelo CONTRATADO, da parcela correspondente aos honorários, diretamente junto ao juízo competente.</p>
<p><b>Cláusula 6ª - DO FORO:</b> Fica eleito o foro da Comarca de {{foro}} para dirimir qualquer dúvida referente a este contrato.</p>
<p class="local-data">{{cidade}}, {{dia}} de {{mesExtenso}} de {{ano}}.</p>
<div class="linha-assinatura">______________________________________________</div>
<div class="legenda-assinatura">CONTRATANTE</div>
<div class="testemunhas">
  <div><div class="linha-assinatura">_______________________________</div><div class="legenda-assinatura">1ª TESTEMUNHA<br/>CPF</div></div>
  <div><div class="linha-assinatura">_______________________________</div><div class="legenda-assinatura">2ª TESTEMUNHA<br/>CPF</div></div>
</div>
${RODAPE}`,
  },
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Preenche o template com os dados do cliente e com a data de hoje. Campos em branco viram "_______". */
export function preencher(modelo: Modelo, cliente: Partial<Cliente> & { honorarios?: string }, escritorio: DadosEscritorioDoc = {}): string {
  const hoje = new Date();
  const base: Record<string, string> = {
    escritorio_nome: escritorio.nome || '',
    escritorio_contato: (escritorio.contato || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).join(' · '),
    advogado_qualificacao: escritorio.qualificacao || '',
    foro: escritorio.foro || '',
    nome: cliente.nome || '',
    cpf: cliente.cpf ? formatarCpf(cliente.cpf) : '',
    rg: cliente.rg || '',
    telefone: cliente.telefone || '',
    estadoCivil: cliente.estadoCivil || '',
    profissao: cliente.profissao || '',
    email: cliente.email || '',
    endereco: cliente.endereco || '',
    numero: cliente.numero || '',
    bairro: cliente.bairro || '',
    cidade: cliente.cidade || '',
    uf: cliente.uf || '',
    cep: cliente.cep || '',
    honorarios: (cliente as Record<string, string>).honorarios || '',
    dia: String(hoje.getDate()).padStart(2, '0'),
    mesExtenso: MESES[hoje.getMonth()],
    ano: String(hoje.getFullYear()),
  };
  return modelo.html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    // Logo: imagem do escritório (data URL) ou a padrão; nunca a lacuna dentro do src
    if (k === 'escritorio_logo') return escaparHtml(/^(data:image\/|\/|https:\/\/)/.test(escritorio.logo || '') ? escritorio.logo! : '/logo.png');
    if (k === 'escritorio_contato' && !base[k]) return '';
    const v = (base[k] || '').trim();
    return v ? escaparHtml(v) : '<span class="lacuna">_________________________</span>';
  });
}

export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
