// Roteiro de implantação de um escritório novo. Meta: tudo pronto em até 3 horas de trabalho.
// O estado fica em escritorios.implantacao: { inicio, <passo>: { feitoEm, por } }.

export interface PassoImplantacao {
  id: string;
  titulo: string;
  minutos: number;
  /** O que fazer, em uma frase */
  como: string;
  /** Onde fazer no app do escritório (rota), quando houver */
  rota?: string;
}

export const PASSOS_IMPLANTACAO: PassoImplantacao[] = [
  { id: 'cadastro', titulo: 'Cadastro, endereço e administrador', minutos: 10, como: 'Criar o escritório na plataforma com subdomínio, plano, OABs e o e-mail do administrador.' },
  { id: 'marca', titulo: 'Marca: logo, nome e cores', minutos: 15, como: 'Enviar o logo e ajustar as cores; conferir a prévia de contraste.', rota: '/config' },
  { id: 'dominio', titulo: 'Domínio próprio (opcional)', minutos: 15, como: 'Apontar o CNAME do domínio do escritório para a plataforma e cadastrar o domínio aqui.' },
  { id: 'equipe', titulo: 'Equipe e papéis', minutos: 20, como: 'Liberar os e-mails da equipe (advogados, assistentes) e enviar o link de primeiro acesso.', rota: '/config' },
  { id: 'prazos', titulo: 'OABs, feriados e calendário', minutos: 15, como: 'Conferir as OABs para o DJEN e cadastrar os feriados municipais das comarcas.', rota: '/agenda' },
  { id: 'processos', titulo: 'Importar processos e clientes', minutos: 50, como: 'Importar pela OAB (DJEN), pelo relatório do sistema anterior ou por planilha; revisar as fases.', rota: '/processos' },
  { id: 'modelos', titulo: 'Modelos de documentos', minutos: 25, como: 'Cadastrar procuração, contrato de honorários e declarações com o timbre do escritório.', rota: '/documentos' },
  { id: 'integracoes', titulo: 'WhatsApp e e-mails dos clientes', minutos: 15, como: 'Conectar a instância do WhatsApp e o domínio dos e-mails gerados.', rota: '/integracoes' },
  { id: 'treinamento', titulo: 'Treinamento e entrega', minutos: 15, como: 'Apresentar a área de trabalho, o fluxo de prazos e tarefas; marcar o escritório como ativo.' },
];

export const MINUTOS_PREVISTOS = PASSOS_IMPLANTACAO.reduce((s, p) => s + p.minutos, 0);

export type EstadoImplantacao = { inicio?: string } & Record<string, { feitoEm: string; por?: string } | string | undefined>;

export const passoFeito = (e: EstadoImplantacao | undefined, id: string) => !!(e && typeof e[id] === 'object' && (e[id] as any)?.feitoEm);

export function progresso(e: EstadoImplantacao | undefined) {
  const feitos = PASSOS_IMPLANTACAO.filter((p) => passoFeito(e, p.id));
  const minutosFeitos = feitos.reduce((s, p) => s + p.minutos, 0);
  return {
    feitos: feitos.length,
    total: PASSOS_IMPLANTACAO.length,
    percentual: Math.round((minutosFeitos / MINUTOS_PREVISTOS) * 100),
    minutosRestantes: MINUTOS_PREVISTOS - minutosFeitos,
    proximo: PASSOS_IMPLANTACAO.find((p) => !passoFeito(e, p.id)),
    concluida: feitos.length === PASSOS_IMPLANTACAO.length,
  };
}

/** Marca ou desmarca um passo (devolve um novo objeto). */
export function alternarPasso(e: EstadoImplantacao | undefined, id: string, por: string, agora: string): EstadoImplantacao {
  const novo: EstadoImplantacao = { ...(e || {}) };
  if (!novo.inicio) novo.inicio = agora;
  if (passoFeito(novo, id)) delete novo[id];
  else novo[id] = { feitoEm: agora, por };
  return novo;
}

/** Minutos corridos entre o início e o último passo concluído (ou agora, se não terminou). */
export function minutosDecorridos(e: EstadoImplantacao | undefined, agora: string): number | null {
  if (!e?.inicio) return null;
  const marcas = PASSOS_IMPLANTACAO.filter((p) => passoFeito(e, p.id)).map((p) => (e[p.id] as { feitoEm: string }).feitoEm);
  const fim = progresso(e).concluida && marcas.length ? marcas.sort().at(-1)! : agora;
  return Math.max(0, Math.round((Date.parse(fim) - Date.parse(e.inicio)) / 60000));
}

export function duracao(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

/** Endereço (slug) a partir do nome: "Silva & Souza Advocacia" → "silva-souza". */
export function slugDoNome(nome: string): string {
  const s = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(advocacia|advogados|associados|sociedade|de|da|do|das|dos|e|escritorio|consultoria|juridica|adv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return s.slice(0, 40).replace(/-+$/, '');
}

const RESERVADOS = new Set(['www', 'app', 'api', 'admin', 'painel', 'plataforma', 'suporte', 'mail', 'status']);
export function slugValido(s: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s) && !RESERVADOS.has(s);
}

/** Domínio próprio: só o host, minúsculo, sem protocolo nem barra. */
export function limparDominioProprio(d: string): string | null {
  const h = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h) ? h : null;
}

/** Endereço de acesso do escritório. */
export function enderecoEscritorio(slug: string, dominioPlataforma: string, dominios: string[] = [], origemAtual = ''): string {
  if (dominios[0]) return `https://${dominios[0]}`;
  if (dominioPlataforma) return `https://${slug}.${dominioPlataforma}`;
  return `${origemAtual}/?escritorio=${slug}`;
}
