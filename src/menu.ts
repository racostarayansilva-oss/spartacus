// Menu do app, em seções. As rotas aqui também são os "módulos" que a plataforma liga ou desliga por escritório.

/** [rota, rótulo, ícone, seção] */
export type ItemMenu = [string, string, string, Secao];
export type Secao = 'inicio' | 'atendimento' | 'juridico' | 'gestao' | 'sistema';

export const SECOES: Record<Secao, string> = {
  inicio: '',
  atendimento: 'Atendimento',
  juridico: 'Jurídico',
  gestao: 'Gestão',
  sistema: 'Escritório',
};

export const MENU: ItemMenu[] = [
  ['/', 'Área de trabalho', 'inicio', 'inicio'],
  ['/clientes', 'Clientes', 'clientes', 'atendimento'],
  ['/whatsapp', 'WhatsApp', 'whatsapp', 'atendimento'],
  ['/emails', 'E-mails dos clientes', 'email', 'atendimento'],
  ['/crm', 'CRM', 'crm', 'atendimento'],
  ['/processos', 'Processos', 'processos', 'juridico'],
  ['/controladoria', 'Publicações', 'controladoria', 'juridico'],
  ['/agenda', 'Prazos e agenda', 'agenda', 'juridico'],
  ['/tarefas', 'Atividades', 'tarefas', 'juridico'],
  ['/documentos', 'Documentos', 'documentos', 'juridico'],
  ['/normas', 'Normas', 'normas', 'juridico'],
  ['/cpf', 'Decisões por CPF', 'cpf', 'juridico'],
  ['/ditado', 'Ditado', 'speak', 'juridico'],
  ['/painel', 'Painel', 'painel', 'gestao'],
  ['/producao', 'Produção', 'producao', 'gestao'],
  ['/financeiro', 'Financeiro', 'financeiro', 'gestao'],
  ['/integracoes', 'Integrações', 'integracoes', 'sistema'],
  ['/senhas', 'Diretório de senhas', 'chave', 'sistema'],
  ['/config', 'Configurações', 'config', 'sistema'],
];

/** Só administradores do escritório. */
export const SO_ADMIN = new Set(['/integracoes', '/senhas']);

/** No celular a barra de baixo mostra só os mais usados; o restante fica na Área de trabalho. */
export const MENU_MOVEL = ['/', '/processos', '/tarefas', '/agenda', '/clientes', '/controladoria'];

/** Itens que a pessoa vê: tira os módulos desligados pela plataforma e os de administrador. */
export function menuVisivel(desligados: string[] = [], administrador: boolean): ItemMenu[] {
  const off = new Set(desligados);
  return MENU.filter(([to]) => !off.has(to) && (!SO_ADMIN.has(to) || administrador));
}

/** Rota liberada para este escritório (rotas internas como /processos/123 seguem o módulo pai). */
export function rotaLiberada(caminho: string, desligados: string[] = []): boolean {
  return !desligados.some((d) => d !== '/' && (caminho === d || caminho.startsWith(d + '/')));
}
