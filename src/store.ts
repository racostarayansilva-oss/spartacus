// Base de dados do app. Nesta primeira versão fica no navegador (localStorage) para o escritório testar.
// O esquema do banco definitivo (Supabase) está em supabase/schema.sql com as mesmas entidades.

import { useSyncExternalStore } from 'react';
import { DataISO, hoje, somarDias } from './lib/datas.js';
import { EtapaRegistrada, TipoProcesso } from './lib/etapas.js';
import { MembroFamilia, Sexo } from './lib/triagem.js';
import { CategoriaMensagem } from './lib/whatsapp.js';
import { Feriado } from './lib/prazos.js';
import { ETIQUETAS_TAREFA } from './lib/dadosIniciais.js';
import { derivarNotificacoes, tarefasMudaramPessoas } from './lib/notificacoes.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

export type Plano = 'essencial' | 'diamante';
export type Papel = 'advogado' | 'equipe' | 'cliente';
export type Canal = 'whatsapp' | 'trafego' | 'corretor' | 'indicacao' | 'presencial' | 'outro';

export interface Usuario { id: string; nome: string; papel: Papel; cpf?: string; oab?: string }
export interface Corretor { id: string; nome: string; telefone: string; regioes: string[] }
export type Beneficio = 'aposentadoria_rural' | 'aposentadoria_urbana' | 'aposentadoria_hibrida' | 'bpc_idoso' | 'bpc_deficiente' | 'maternidade' | 'incapacidade' | 'pensao' | 'outro';
export interface DocumentoDossie { id: string; nome: string; entregue: boolean }
export interface AnotacaoDossie { id: string; data: DataISO; usuarioId: string; texto: string }
export interface Cliente {
  id: string; nome: string; cpf: string; telefone: string;
  origem: 'trafego' | 'corretor' | 'indicacao' | 'nao_informada'; corretorId?: string | null;
  responsavelId?: string; obs?: string; criadoEm: DataISO;
  /** Dados para preencher procuração, contrato e declarações. */
  rg?: string; estadoCivil?: string; profissao?: string; email?: string;
  endereco?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string;
  /** Dossiê */
  nascimento?: DataISO; sexo?: Sexo; beneficio?: Beneficio;
  documentos?: DocumentoDossie[];
  anotacoes?: AnotacaoDossie[];
  /** Endereço criado pelo escritório para o cliente (cadastro no gov.br/Meu INSS); os e-mails chegam em "E-mails dos clientes". */
  emailGerado?: string;
}
/** E-mail que chegou no endereço gerado de um cliente (gravado pelo servidor). */
export interface EmailRecebido {
  id: string; clienteId?: string | null; para: string; de: string; assunto: string;
  texto?: string; html?: string; anexos?: { nome: string; tipo: string; tamanho: number }[];
  recebidoEm: string; lido: boolean;
}
/** Aviso da central de notificações (cada pessoa só vê as suas). */
export interface Notificacao {
  id: string; paraId: string; deId: string;
  /** aviso: mensagem do sistema (tarefaTitulo é o título, trecho o texto, link para onde leva) */
  tipo: 'tarefa_criada' | 'tarefa_atribuida' | 'mencao' | 'aviso';
  tarefaId: string; tarefaTitulo: string; trecho?: string; comentarioId?: string; link?: string;
  em: string; lida: boolean;
}
/** Diretório de senhas (só administradores veem e alteram). */
export interface Senha {
  id: string; titulo: string; email?: string; telefone?: string; usuario?: string; senha?: string; observacao?: string;
  atualizadoEm: string; atualizadoPor?: string;
}
export interface Processo {
  id: string; numero: string; tipo: TipoProcesso; clienteId: string; assunto: string;
  responsavelId: string; valor: number; corretorId?: string | null; regiao: string;
  etapas: EtapaRegistrada[]; grupoFamiliar: MembroFamilia[];
  movimentosOficiais?: { data: string; nome: string; complemento?: string }[];
  atualizadoDataJud?: string;
  /** Ids das etiquetas (Config.etiquetas) */
  etiquetas?: string[];
  /** Etapas que a leitura das movimentações sugeriu e a equipe descartou (não sugere de novo) */
  etapasIgnoradas?: string[];
  /** Capa do processo vinda do DataJud (classe, assuntos, órgão, ajuizamento) */
  dadosJudiciais?: { classe?: string; assuntos?: string[]; orgao?: string; tribunal?: string; grau?: string; ajuizamento?: string; atualizadoEm: string };
  /** Provisionamento contábil da ação (estimativa de perda) */
  provisionamento?: { provisionar: boolean; valor?: number; risco?: 'provavel' | 'possivel' | 'remota' };
  /** Resumo Inteligente gerado por IA (só quando alguém pede, na ficha) */
  resumoIA?: { texto: string; pontos: string[]; geradoEm: string; geradoPor: string; modelo: string };
  /** Fase no Legis (relatório de processos): instrução, recursal ou execução */
  faseLegis?: 'instrucao' | 'recursal' | 'execucao';
  /** Execução: valor e andamento da RPV */
  rpv?: DadosRpv;
}
export type SituacaoRpv = 'calculos' | 'aguardando_expedicao' | 'expedida' | 'trf1' | 'paga';
export interface DadosRpv {
  valor: number; situacao: SituacaoRpv;
  movimentacao?: string; ultimaMovimentacao?: DataISO; proximoPasso?: string;
  /** Honorários contratuais (%) sobre a RPV; sem valor, vale o padrão de 30% */
  percentual?: number;
  /** Lançamento de honorários a receber criado a partir desta RPV (Financeiro) */
  lancamentoId?: string;
  atualizadoEm: string;
}
export type TipoRegistro = 'entrada' | 'protocolo' | 'despacho' | 'sentenca' | 'recurso' | 'audiencia' | 'dilacao' | 'exigencia';
export interface Registro {
  id: string; data: DataISO; tipo: TipoRegistro; usuarioId: string; processoId?: string | null;
  canal?: Canal; resultado?: 'favoravel' | 'desfavoravel' | 'procedente' | 'parcial' | 'improcedente'; descricao?: string;
}
export interface Testemunha { nome: string; telefone: string }
export interface Audiencia {
  id: string; processoId: string; data: DataISO; hora: string; local: string;
  testemunhas: Testemunha[]; clienteContatado: boolean; testemunhasConfirmadas: boolean;
}
export interface Intimacao {
  id: string; disponibilizacao: DataISO; tribunal: string; processoNumero: string; texto: string;
  dias: number; responsavelId?: string; status: 'nova' | 'tratada'; prazoId?: string; origem: 'djen' | 'manual';
}
export interface Compromisso {
  id: string; titulo: string; data: DataISO; origem: 'judicial' | 'inss' | 'audiencia' | 'interno';
  responsavelId: string; status: 'pendente' | 'concluido'; processoId?: string | null; base?: string;
}
export interface Tarefa {
  id: string; titulo: string;
  /** Responsável principal (os pontos contam para ele) */
  responsavelId: string;
  pontos: 1 | 2 | 3 | 5 | 8;
  /** Situação gravada; as colunas do quadro são calculadas em lib/tarefas.ts */
  coluna: 'afazer' | 'fazendo' | 'revisao' | 'concluido'; processoId?: string | null; prazo?: DataISO | null; concluidaEm?: DataISO | null;
  /** Outras pessoas da equipe na tarefa */
  participantes?: string[];
  /** "HH:MM" (opcional) */
  hora?: string | null;
  descricao?: string;
  /** Ids de Config.etiquetasTarefa */
  etiquetas?: string[];
  comentarios?: { id: string; em: string; usuarioId: string; texto: string }[];
  historico?: { em: string; usuarioId: string; texto: string }[];
  criadaEm?: string;
  criadaPor?: string;
  /** De onde veio: manual, intimação da Controladoria… */
  origem?: 'manual' | 'intimacao' | 'legis';
  /** Última importação do Legis que gravou esta tarefa (essas gravações não geram notificação) */
  importadaLegisEm?: string;
  intimacaoId?: string;
}
export interface Mensagem {
  id: string; dataHora: string; telefone: string; nome: string; texto: string; temAnexo?: boolean;
  categoria: CategoriaMensagem; clienteId?: string | null; corretorId?: string | null; respondida: boolean;
}
export interface PedidoProtocolo {
  id: string; clienteId: string; solicitante: string; corretorId?: string | null; vezes: number;
  primeiroPedido: DataISO; ultimoPedido: DataISO; situacao: 'pendente' | 'protocolado'; protocoladoEm?: DataISO;
}
export interface Lancamento {
  id: string; tipo: 'receita' | 'despesa'; descricao: string; valor: number; vencimento: DataISO;
  pago: boolean; pagoEm?: DataISO | null; processoId?: string | null; categoria?: string;
}
export interface LogCpf { em: string; usuarioId: string; cpfMascarado: string; resultado: string }
export interface Etiqueta { id: string; nome: string; cor: string }

export type TipoAtividade = 'atendimento' | 'ligacao' | 'peticao' | 'protocolo' | 'audiencia' | 'diligencia' | 'documento' | 'pesquisa' | 'reuniao' | 'outra';
/** Atividade lançada à mão na Produção (tarefas concluídas e registros entram sozinhos, sem lançamento). */
export interface Atividade {
  id: string; data: DataISO; usuarioId: string; tipo: TipoAtividade; titulo: string; descricao?: string;
  status: 'concluida' | 'andamento';
  minutos?: number;
  processoId?: string | null; clienteId?: string | null;
  criadaEm: string; criadaPor?: string;
}
/** Relatório diário entregue. O id é "usuario:data", então reentregar substitui o anterior. */
export interface RelatorioDiario {
  id: string; data: DataISO; usuarioId: string; entregueEm: string;
  resumo: string; pendencias?: string; amanha?: string;
  pontos: number; itens: number;
}

/** Histórico da aba Importações (quem importou, de onde e quantos processos). */
export interface RegistroImportacao {
  id: string;
  em: string; // data e hora ISO
  usuarioId: string;
  usuarioNome: string;
  fonte: string; // ex.: "OAB (DJEN/CNJ)"
  oabs: string[]; // ex.: ["OAB/MA 14427"]
  periodo?: { inicio: DataISO; fim: DataISO };
  processosNovos: number;
  clientesNovos: number;
  jaExistentes: number;
  observacao?: string;
}

export interface Config {
  plano: Plano; usuarioAtualId: string; nomeEscritorio: string; oabs: { numero: string; uf: string }[];
  feriadosExtras: Feriado[]; tema: 'claro' | 'escuro' | 'sistema';
  importacoes?: RegistroImportacao[];
  etiquetas?: Etiqueta[];
  /** Normas fixadas pelo escritório na tela de Normas (atalho para as mais usadas) */
  normasFixadas?: { id: string; referencia: string; apelido?: string }[];
  /** Etiquetas das tarefas (as barrinhas coloridas no cartão) */
  etiquetasTarefa?: Etiqueta[];
  /** Correções de dados já aplicadas (rodam uma vez só) */
  migracoes?: string[];
  /** Importação do Legis: nome no Legis → id da pessoa no RA Connect ("" = ninguém) */
  responsaveisLegis?: Record<string, string>;
  /** Domínio dos e-mails gerados para os clientes (ex.: clientes.racosta.adv.br) */
  dominioEmails?: string;
}

export interface Banco {
  versao: number; config: Config; usuarios: Usuario[]; corretores: Corretor[]; clientes: Cliente[];
  processos: Processo[]; registros: Registro[]; audiencias: Audiencia[]; intimacoes: Intimacao[];
  compromissos: Compromisso[]; tarefas: Tarefa[]; mensagens: Mensagem[]; pedidos: PedidoProtocolo[];
  lancamentos: Lancamento[]; logsCpf: LogCpf[]; atividades: Atividade[]; relatoriosDiarios: RelatorioDiario[];
  emails: EmailRecebido[]; senhas: Senha[]; notificacoes: Notificacao[];
}

const CHAVE = 'ra-connect:banco:v1';

export const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function seed(): Banco {
  const h = hoje();
  const d = (n: number) => somarDias(h, n);
  const usuarios: Usuario[] = [
    { id: 'u-adm', nome: 'Dra. Helena Duarte', papel: 'advogado', oab: 'SP 123.456' },
    { id: 'u-ana', nome: 'Ana (Controladoria)', papel: 'equipe' },
    { id: 'u-bruno', nome: 'Bruno (Protocolo)', papel: 'equipe' },
    { id: 'u-carla', nome: 'Carla (Atendimento)', papel: 'equipe' },
  ];
  const corretores: Corretor[] = [
    { id: 'k-jose', nome: 'José do Sindicato', telefone: '(91) 98888-1001', regioes: ['Tomé-Açu', 'Quatro Bocas'] },
    { id: 'k-raimunda', nome: 'Raimunda Corretora', telefone: '(91) 98888-2002', regioes: ['Breves', 'Curralinho'] },
    { id: 'k-marcos', nome: 'Marcos Lima', telefone: '(98) 98888-3003', regioes: ['São Luís', 'Rosário'] },
  ];
  const clientes: Cliente[] = [
    {
      id: 'c-maria', nome: 'Maria das Graças Souza', cpf: '52998224725', telefone: '(91) 99111-0001', origem: 'corretor', corretorId: 'k-jose', responsavelId: 'u-adm', criadoEm: d(-300),
      nascimento: '1969-03-12', sexo: 'F', beneficio: 'aposentadoria_rural', cidade: 'Tomé-Açu', uf: 'PA',
      documentos: [
        { id: 'dm1', nome: 'RG e CPF', entregue: true },
        { id: 'dm2', nome: 'Certidão de nascimento ou casamento', entregue: true },
        { id: 'dm3', nome: 'CNIS atualizado', entregue: false },
        { id: 'dm4', nome: 'Documentos que comprovem atividade rural', entregue: false },
      ],
      anotacoes: [{ id: 'am1', data: d(-30), usuarioId: 'u-ana', texto: 'Falta prova material do período de 2010 a 2015. Pedir declaração do sindicato.' }],
      emailGerado: 'maria.souza.k3f9@clientes.exemplo.adv.br',
    },
    { id: 'c-francisca', nome: 'Francisca Pereira Lima', cpf: '11144477735', telefone: '(91) 99111-0002', origem: 'corretor', corretorId: 'k-raimunda', responsavelId: 'u-adm', criadoEm: d(-200), nascimento: '1998-10-02', sexo: 'F', beneficio: 'maternidade', cidade: 'Breves', uf: 'PA' },
    { id: 'c-antonio', nome: 'Antônio Carlos Ribeiro', cpf: '39053344705', telefone: '(98) 99111-0003', origem: 'trafego', responsavelId: 'u-ana', criadoEm: d(-150), cidade: 'São Luís', uf: 'MA', beneficio: 'outro' },
    { id: 'c-joana', nome: 'Joana Batista Cruz', cpf: '15350946056', telefone: '(91) 99111-0004', origem: 'corretor', corretorId: 'k-jose', responsavelId: 'u-carla', criadoEm: d(-20), nascimento: '1958-07-07', sexo: 'F', beneficio: 'bpc_idoso', cidade: 'Quatro Bocas', uf: 'PA' },
    { id: 'c-pedro', nome: 'Pedro Henrique Matos', cpf: '74682489070', telefone: '(98) 99111-0005', origem: 'indicacao', responsavelId: 'u-carla', criadoEm: d(-5), nascimento: '1967-05-30', sexo: 'M', beneficio: 'aposentadoria_rural', cidade: 'Ipixuna do Pará', uf: 'PA', corretorId: 'k-marcos' },
    { id: 'c-lucia', nome: 'Lúcia Ferreira', cpf: '28625587887', telefone: '(91) 99111-0006', origem: 'trafego', criadoEm: d(-1) },
  ];
  const processos: Processo[] = [
    {
      id: 'p1', numero: '1001234-56.2025.4.01.3900', tipo: 'JEF', clienteId: 'c-maria', assunto: 'Aposentadoria por idade rural',
      responsavelId: 'u-adm', valor: 48_000, corretorId: 'k-jose', regiao: 'Tomé-Açu',
      etapas: [
        { etapa: 'Entrada', data: d(-300) }, { etapa: 'Documentação', data: d(-290) }, { etapa: 'DER no INSS', data: d(-280) },
        { etapa: 'Decisão INSS', data: d(-190), obs: 'Indeferido: falta de prova material' }, { etapa: 'Ajuizamento', data: d(-170) },
        { etapa: 'Citação/contestação', data: d(-120) },
      ],
      grupoFamiliar: [
        { id: 'g1', nome: 'Maria das Graças Souza', parentesco: 'Titular', sexo: 'F', nascimento: '1969-03-12' },
        { id: 'g2', nome: 'Raimundo Souza', parentesco: 'Cônjuge', sexo: 'M', nascimento: '1967-08-30' },
        { id: 'g3', nome: 'Aline Souza', parentesco: 'Filha', sexo: 'F', nascimento: '2001-05-04', ultimoParto: d(-400) },
        { id: 'g4', nome: 'Dona Benedita Souza', parentesco: 'Mãe', sexo: 'F', nascimento: '1956-01-20' },
      ],
    },
    {
      id: 'p2', numero: 'NB 214.567.890-1', tipo: 'ADM_INSS', clienteId: 'c-francisca', assunto: 'Salário-maternidade rural',
      responsavelId: 'u-ana', valor: 6_100, corretorId: 'k-raimunda', regiao: 'Breves',
      etapas: [{ etapa: 'Entrada', data: d(-60) }, { etapa: 'Documentação', data: d(-55) }, { etapa: 'DER', data: d(-50) }, { etapa: 'Exigência', data: d(-8) }],
      grupoFamiliar: [
        { id: 'g5', nome: 'Francisca Pereira Lima', parentesco: 'Titular', sexo: 'F', nascimento: '1998-10-02', ultimoParto: d(-90) },
        { id: 'g6', nome: 'Josefa Pereira', parentesco: 'Irmã', sexo: 'F', nascimento: '2003-02-14', partoPrevisto: d(120) },
      ],
    },
    {
      id: 'p3', numero: '0801111-22.2025.8.10.0001', tipo: 'CIVEL', clienteId: 'c-antonio', assunto: 'Indenização — negativação indevida',
      responsavelId: 'u-adm', valor: 15_000, regiao: 'São Luís',
      etapas: [{ etapa: 'Entrada', data: d(-150) }, { etapa: 'Ajuizamento', data: d(-140) }, { etapa: 'Citação/contestação', data: d(-90) }, { etapa: 'Réplica', data: d(-60) }],
      grupoFamiliar: [],
    },
    {
      id: 'p4', numero: '1009999-11.2024.4.01.3700', tipo: 'JEF', clienteId: 'c-joana', assunto: 'BPC/LOAS idoso',
      responsavelId: 'u-adm', valor: 32_000, corretorId: 'k-jose', regiao: 'Quatro Bocas',
      etapas: [{ etapa: 'Entrada', data: d(-400) }, { etapa: 'DER no INSS', data: d(-380) }, { etapa: 'Decisão INSS', data: d(-300) }, { etapa: 'Ajuizamento', data: d(-280) }, { etapa: 'Audiência/perícia', data: d(-100) }, { etapa: 'Sentença', data: d(-40), resultado: 'procedente' }, { etapa: 'RPV/pagamento', data: d(-5) }],
      grupoFamiliar: [{ id: 'g7', nome: 'Joana Batista Cruz', parentesco: 'Titular', sexo: 'F', nascimento: '1958-07-07' }],
    },
  ];
  const registros: Registro[] = [
    { id: novoId(), data: h, tipo: 'entrada', canal: 'whatsapp', usuarioId: 'u-carla', descricao: 'Lead Lúcia' },
    { id: novoId(), data: h, tipo: 'entrada', canal: 'whatsapp', usuarioId: 'u-carla' },
    { id: novoId(), data: h, tipo: 'entrada', canal: 'corretor', usuarioId: 'u-carla' },
    { id: novoId(), data: d(-1), tipo: 'protocolo', usuarioId: 'u-bruno', processoId: 'p2', descricao: 'DER salário-maternidade' },
    { id: novoId(), data: d(-2), tipo: 'despacho', resultado: 'favoravel', usuarioId: 'u-ana', processoId: 'p1' },
    { id: novoId(), data: d(-3), tipo: 'despacho', resultado: 'desfavoravel', usuarioId: 'u-ana', processoId: 'p3' },
    { id: novoId(), data: d(-4), tipo: 'sentenca', resultado: 'procedente', usuarioId: 'u-adm', processoId: 'p4' },
    { id: novoId(), data: d(-12), tipo: 'sentenca', resultado: 'parcial', usuarioId: 'u-adm' },
    { id: novoId(), data: d(-20), tipo: 'sentenca', resultado: 'improcedente', usuarioId: 'u-adm' },
    { id: novoId(), data: d(-6), tipo: 'recurso', usuarioId: 'u-adm' },
    { id: novoId(), data: d(-2), tipo: 'dilacao', usuarioId: 'u-ana' },
    { id: novoId(), data: d(-1), tipo: 'exigencia', usuarioId: 'u-bruno' },
  ];
  const audiencias: Audiencia[] = [
    { id: 'a1', processoId: 'p1', data: d(5), hora: '09:30', local: 'JEF Belém — sala virtual', testemunhas: [{ nome: 'Sebastião Alves', telefone: '(91) 98111-1111' }, { nome: 'Rosa Maria', telefone: '(91) 98111-2222' }], clienteContatado: true, testemunhasConfirmadas: false },
    { id: 'a2', processoId: 'p3', data: d(20), hora: '14:00', local: '5º Juizado Cível de São Luís', testemunhas: [], clienteContatado: false, testemunhasConfirmadas: false },
  ];
  const intimacoes: Intimacao[] = [
    { id: 'i1', disponibilizacao: d(-1), tribunal: 'TRF1', processoNumero: '1001234-56.2025.4.01.3900', texto: 'Intimação para apresentar rol de testemunhas no prazo de 5 dias.', dias: 5, status: 'nova', origem: 'manual' },
    { id: 'i2', disponibilizacao: d(-2), tribunal: 'TJMA', processoNumero: '0801111-22.2025.8.10.0001', texto: 'Intime-se a parte autora para se manifestar sobre a contestação em 15 dias.', dias: 15, status: 'nova', origem: 'manual' },
  ];
  const compromissos: Compromisso[] = [
    { id: 'm1', titulo: 'Cumprir exigência INSS — Francisca', data: d(22), origem: 'inss', responsavelId: 'u-bruno', status: 'pendente', processoId: 'p2', base: 'IN 212/2026 (30 dias)' },
    { id: 'm2', titulo: 'Réplica — Antônio', data: h, origem: 'judicial', responsavelId: 'u-adm', status: 'pendente', processoId: 'p3' },
    { id: 'm3', titulo: 'Reunião de equipe', data: d(2), origem: 'interno', responsavelId: 'u-ana', status: 'pendente' },
  ];
  const tarefas: Tarefa[] = [
    { id: 't1', titulo: 'Montar rol de testemunhas — Maria', responsavelId: 'u-ana', participantes: ['u-carla'], pontos: 2, coluna: 'fazendo', processoId: 'p1', prazo: d(3), etiquetas: ['ett-audiencia'] },
    { id: 't2', titulo: 'Petição inicial BPC — Joana (novo caso)', responsavelId: 'u-adm', pontos: 8, coluna: 'afazer', prazo: d(10) },
    { id: 't3', titulo: 'Juntar autodeclaração rural', responsavelId: 'u-bruno', pontos: 1, coluna: 'revisao', processoId: 'p2', etiquetas: ['ett-inss'] },
    { id: 't4', titulo: 'Calcular honorários RPV — Joana', responsavelId: 'u-ana', pontos: 3, coluna: 'concluido', processoId: 'p4', concluidaEm: d(-2) },
    { id: 't5', titulo: 'Réplica à contestação — Antônio', responsavelId: 'u-adm', participantes: ['u-ana'], pontos: 5, coluna: 'afazer', processoId: 'p3', prazo: h, hora: '17:00', etiquetas: ['ett-prazo', 'ett-urgente'] },
    { id: 't6', titulo: 'Cumprir exigência do INSS — Francisca', responsavelId: 'u-bruno', pontos: 3, coluna: 'afazer', processoId: 'p2', prazo: d(-1), etiquetas: ['ett-inss', 'ett-urgente'] },
    { id: 't7', titulo: 'Ligar para as testemunhas — Maria', responsavelId: 'u-carla', pontos: 1, coluna: 'concluido', processoId: 'p1', prazo: h, concluidaEm: h },
  ];
  const mensagens: Mensagem[] = [
    { id: 'w1', dataHora: `${h}T08:12`, telefone: '(91) 99111-0001', nome: 'Maria das Graças', texto: 'Bom dia doutor, como anda meu processo?', categoria: 'andamento', clienteId: 'c-maria', respondida: false },
    { id: 'w2', dataHora: `${h}T09:40`, telefone: '(91) 98888-1001', nome: 'José do Sindicato', texto: 'Doutor, protocola pra mim a da Joana, já mandei tudo', categoria: 'protocolo', clienteId: 'c-joana', corretorId: 'k-jose', respondida: false },
    { id: 'w3', dataHora: `${h}T10:05`, telefone: '(91) 99111-0002', nome: 'Francisca', texto: 'Segue o RG e a certidão do bebê', temAnexo: true, categoria: 'documentos', clienteId: 'c-francisca', respondida: false },
  ];
  const pedidos: PedidoProtocolo[] = [
    { id: 'pp1', clienteId: 'c-joana', solicitante: 'José do Sindicato', corretorId: 'k-jose', vezes: 3, primeiroPedido: d(-6), ultimoPedido: h, situacao: 'pendente' },
    { id: 'pp2', clienteId: 'c-joana', solicitante: 'Raimunda Corretora', corretorId: 'k-raimunda', vezes: 1, primeiroPedido: d(-3), ultimoPedido: d(-3), situacao: 'pendente' },
    { id: 'pp3', clienteId: 'c-francisca', solicitante: 'Raimunda Corretora', corretorId: 'k-raimunda', vezes: 1, primeiroPedido: d(-52), ultimoPedido: d(-52), situacao: 'protocolado', protocoladoEm: d(-50) },
  ];
  const lancamentos: Lancamento[] = [
    { id: 'f1', tipo: 'receita', descricao: 'Honorários RPV — Joana (30%)', valor: 9_600, vencimento: d(25), pago: false, processoId: 'p4', categoria: 'Honorários RPV' },
    { id: 'f2', tipo: 'receita', descricao: 'Entrada contrato — Antônio', valor: 1_500, vencimento: d(-10), pago: true, pagoEm: d(-10), processoId: 'p3', categoria: 'Honorários iniciais' },
    { id: 'f3', tipo: 'despesa', descricao: 'Tráfego pago — Meta Ads', valor: 1_200, vencimento: d(-3), pago: true, pagoEm: d(-3), categoria: 'Marketing' },
    { id: 'f4', tipo: 'despesa', descricao: 'Aluguel unidade Tomé-Açu', valor: 1_800, vencimento: d(6), pago: false, categoria: 'Estrutura' },
  ];
  const atividades: Atividade[] = [
    { id: 'at1', data: d(-1), usuarioId: 'u-adm', tipo: 'atendimento', titulo: 'Reunião com Maria sobre a aposentadoria', descricao: 'Alinhada a estratégia para a audiência e as provas que ainda faltam.', status: 'concluida', minutos: 45, processoId: 'p1', clienteId: 'c-maria', criadaEm: `${d(-1)}T14:45` },
    { id: 'at2', data: h, usuarioId: 'u-ana', tipo: 'protocolo', titulo: 'Protocolo da DER — Francisca', descricao: 'Requerimento de salário-maternidade rural enviado pelo Meu INSS.', status: 'concluida', minutos: 30, processoId: 'p2', clienteId: 'c-francisca', criadaEm: `${h}T11:00` },
    { id: 'at3', data: h, usuarioId: 'u-carla', tipo: 'ligacao', titulo: 'Confirmação da audiência com Joana', status: 'concluida', minutos: 15, processoId: 'p4', clienteId: 'c-joana', criadaEm: `${h}T09:15` },
    { id: 'at4', data: h, usuarioId: 'u-bruno', tipo: 'pesquisa', titulo: 'Jurisprudência sobre negativação indevida', descricao: 'Separadas 4 decisões do TJMA para a réplica.', status: 'concluida', minutos: 90, processoId: 'p3', criadaEm: `${h}T12:30` },
    { id: 'at5', data: h, usuarioId: 'u-adm', tipo: 'peticao', titulo: 'Petição inicial do BPC — Joana', status: 'andamento', minutos: 60, clienteId: 'c-joana', criadaEm: `${h}T15:00` },
  ];
  const relatoriosDiarios: RelatorioDiario[] = [
    { id: `u-ana:${d(-1)}`, data: d(-1), usuarioId: 'u-ana', entregueEm: `${d(-1)}T18:04:00`, resumo: 'Tratei as intimações do dia e revisei o rol de testemunhas da Maria.', pontos: 5, itens: 3 },
    { id: `u-adm:${d(-1)}`, data: d(-1), usuarioId: 'u-adm', entregueEm: `${d(-1)}T19:10:00`, resumo: 'Reunião com Maria e revisão das peças da semana.', pontos: 4, itens: 2 },
  ];
  return {
    versao: 1,
    config: {
      plano: 'diamante', usuarioAtualId: 'u-adm', nomeEscritorio: 'Duarte Advocacia (exemplo)',
      oabs: [{ numero: '123456', uf: 'SP' }], feriadosExtras: [], tema: 'escuro',
      etiquetasTarefa: ETIQUETAS_TAREFA, dominioEmails: 'clientes.exemplo.adv.br',
    },
    usuarios, corretores, clientes, processos, registros, audiencias, intimacoes, compromissos, tarefas, mensagens, pedidos, lancamentos, logsCpf: [], atividades, relatoriosDiarios,
    emails: [
      {
        id: 'em1', clienteId: 'c-maria', para: 'maria.souza.k3f9@clientes.exemplo.adv.br', de: 'gov.br <naoresponda@acesso.gov.br>',
        assunto: 'gov.br - Código de verificação', recebidoEm: `${d(0)}T09:12:00`, lido: false,
        texto: 'Olá, MARIA DAS GRAÇAS SOUZA.\n\nSeu código de verificação é: 482913\n\nSe não foi você que solicitou, ignore este e-mail.\n\nEste e-mail é automático. Não é necessário respondê-lo.',
      },
      {
        id: 'em2', clienteId: 'c-maria', para: 'maria.souza.k3f9@clientes.exemplo.adv.br', de: 'Meu INSS <naoresponda@inss.gov.br>',
        assunto: 'Atualização do seu requerimento', recebidoEm: `${d(-2)}T14:40:00`, lido: true,
        texto: 'Prezada MARIA DAS GRAÇAS SOUZA,\n\nHouve uma atualização no seu requerimento. Acesse o Meu INSS para consultar.',
      },
    ],
    notificacoes: [
      { id: 'n1', paraId: 'u-adm', deId: 'u-ana', tipo: 'mencao', tarefaId: 't1', tarefaTitulo: 'Montar rol de testemunhas — Maria', trecho: '@Rômulo pode revisar o rol antes de protocolar?', em: `${d(0)}T08:40:00`, lida: false },
      { id: 'n2', paraId: 'u-adm', deId: 'u-carla', tipo: 'tarefa_criada', tarefaId: 't2', tarefaTitulo: 'Petição inicial BPC — Joana (novo caso)', em: `${d(-1)}T16:05:00`, lida: true },
    ],
    senhas: [
      { id: 's1', titulo: 'Meu INSS — Maria das Graças', email: 'maria.souza.k3f9@clientes.exemplo.adv.br', usuario: '529.982.247-25', senha: 'Exemplo@2026', observacao: 'Conta gov.br nível prata. Código de verificação chega em E-mails dos clientes.', atualizadoEm: `${d(-3)}T10:00:00`, atualizadoPor: 'u-adm' },
    ],
  };
}

/** Com Supabase configurado, os dados ficam na nuvem e exigem login. Sem ele, ficam no navegador (modo de testes). */
export const MODO_NUVEM = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Banco vazio usado na nuvem até os dados chegarem. */
export function bancoVazio(): Banco {
  const s = seed();
  return {
    ...s,
    config: { ...s.config, usuarioAtualId: '', feriadosExtras: [], dominioEmails: undefined },
    usuarios: [], corretores: [], clientes: [], processos: [], registros: [], audiencias: [], intimacoes: [],
    compromissos: [], tarefas: [], mensagens: [], pedidos: [], lancamentos: [], logsCpf: [], atividades: [], relatoriosDiarios: [],
    emails: [], senhas: [], notificacoes: [],
  };
}

/** Backups e dados salvos antes da Produção não têm as coleções novas. */
function completar(b: Banco): Banco {
  b.atividades ??= [];
  b.relatoriosDiarios ??= [];
  b.emails ??= [];
  b.senhas ??= [];
  b.notificacoes ??= [];
  return b;
}

function carregar(): Banco {
  if (MODO_NUVEM) return bancoVazio();
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return completar(JSON.parse(bruto) as Banco);
  } catch {
    /* navegador sem armazenamento: usa os dados de exemplo */
  }
  return seed();
}

let estado: Banco = carregar();
const ouvintes = new Set<() => void>();
let sincronizar: ((antes: Banco, depois: Banco) => void) | null = null;

function salvar() {
  if (MODO_NUVEM) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* sem armazenamento: mantém só na memória */
  }
}

const avisar = () => ouvintes.forEach((o) => o());

/** Na nuvem, o módulo nuvem.ts registra aqui a função que grava as alterações no Supabase. */
export function registrarSincronizador(fn: (antes: Banco, depois: Banco) => void) {
  sincronizar = fn;
}

/** Troca o estado inteiro sem gravar (dados que acabaram de chegar do banco). */
export function substituir(b: Banco) {
  estado = b;
  avisar();
}

/** Altera o banco. A função recebe uma cópia e pode modificá-la diretamente. */
export function alterar(fn: (b: Banco) => void) {
  const antes = estado;
  const copia: Banco = structuredClone(estado);
  fn(copia);
  // Central de notificações: quem entrou numa tarefa ou foi mencionado com @
  if (tarefasMudaramPessoas(antes.tarefas, copia.tarefas)) {
    const novas = derivarNotificacoes(antes.tarefas, copia.tarefas, copia.usuarios, copia.config.usuarioAtualId, new Date().toISOString(), novoId);
    if (novas.length) copia.notificacoes = [...(copia.notificacoes ?? []), ...novas];
  }
  estado = copia;
  salvar();
  sincronizar?.(antes, copia);
  avisar();
}

export function obter(): Banco {
  return estado;
}

export function restaurarExemplo() {
  if (MODO_NUVEM) throw new Error('Na nuvem, os dados de exemplo não podem ser restaurados (apagaria os dados da equipe).');
  estado = seed();
  salvar();
  avisar();
}

export function exportarJson(): string {
  return JSON.stringify(estado, null, 2);
}

/** Importa um backup. Na nuvem, substitui os dados do escritório pelos do arquivo. */
export function importarJson(texto: string) {
  const b = JSON.parse(texto) as Banco;
  if (!b || !Array.isArray(b.processos)) throw new Error('Arquivo não parece um backup do RA Connect.');
  // Backup sem e-mails ou sem senhas (feito por quem não é administrador, ou antes delas) não apaga as atuais
  const manterEmails = !Array.isArray(b.emails), manterSenhas = !Array.isArray(b.senhas), manterNotif = !Array.isArray(b.notificacoes);
  completar(b);
  if (MODO_NUVEM) {
    // Usuários e logs vêm do login/servidor; mantém os atuais
    alterar((db) => {
      Object.assign(db, {
        ...b, usuarios: db.usuarios, logsCpf: db.logsCpf,
        emails: manterEmails ? db.emails : b.emails, senhas: manterSenhas ? db.senhas : b.senhas,
        notificacoes: manterNotif ? db.notificacoes : b.notificacoes,
        config: { ...b.config, usuarioAtualId: db.config.usuarioAtualId, tema: db.config.tema },
      });
    });
    return;
  }
  estado = b;
  salvar();
  avisar();
}

export function useBanco(): Banco {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => estado,
  );
}

// Ajudantes de leitura
export const nomeUsuario = (b: Banco, id?: string | null) => b.usuarios.find((u) => u.id === id)?.nome ?? '—';
export const nomeCliente = (b: Banco, id?: string | null) => b.clientes.find((c) => c.id === id)?.nome ?? '—';
export const nomeCorretor = (b: Banco, id?: string | null) => b.corretores.find((c) => c.id === id)?.nome ?? '—';
export const usuarioAtual = (b: Banco) => b.usuarios.find((u) => u.id === b.config.usuarioAtualId) ?? b.usuarios[0];
export const ehDiamante = (b: Banco) => b.config.plano === 'diamante';
