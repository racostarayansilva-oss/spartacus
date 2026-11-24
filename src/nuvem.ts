// Ligação com o Supabase: login, carregamento dos dados, gravação das alterações e tempo real.
// Só é usado quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas.

import { useSyncExternalStore } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { DOMINIO_PLATAFORMA, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { definirEscritorio, EscritorioPublico, hostDoEscritorio, marcaAtual } from './marca';
import { Banco, bancoVazio, Config, MODO_NUVEM, obter, registrarSincronizador, substituir, Usuario } from './store';

export const supabase: SupabaseClient | null = MODO_NUVEM
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

type Colecao = 'corretores' | 'clientes' | 'processos' | 'registros' | 'audiencias' | 'intimacoes' | 'compromissos' | 'tarefas' | 'mensagens' | 'pedidos' | 'lancamentos' | 'atividades' | 'relatoriosDiarios' | 'emails' | 'senhas' | 'notificacoes';

const TABELAS: [Colecao, string][] = [
  ['corretores', 'corretores'], ['clientes', 'clientes'], ['processos', 'processos'], ['registros', 'registros'],
  ['audiencias', 'audiencias'], ['intimacoes', 'intimacoes'], ['compromissos', 'compromissos'], ['tarefas', 'tarefas'],
  ['mensagens', 'mensagens'], ['pedidos', 'pedidos_protocolo'], ['lancamentos', 'lancamentos'],
  ['atividades', 'atividades'], ['relatoriosDiarios', 'relatorios_diarios'],
  ['emails', 'emails_recebidos'], ['senhas', 'senhas'], ['notificacoes', 'notificacoes'],
];
// Tabelas criadas depois da primeira versão do schema.sql: se ainda não existirem, o app abre assim mesmo.
const OPCIONAIS = new Set(['atividades', 'relatorios_diarios', 'emails_recebidos', 'senhas', 'notificacoes']);
const faltando = new Set<string>();
/** Na nuvem, true enquanto as tabelas da Produção não forem criadas (rodar supabase/schema.sql de novo). */
export const producaoSemTabela = () => faltando.has('atividades') || faltando.has('relatorios_diarios');
/** Na nuvem, true enquanto a tabela não existir (rodar supabase/schema.sql de novo). */
export const semTabela = (t: 'emails_recebidos' | 'senhas') => faltando.has(t);

/** Administrador: cria (ou troca) a chave que o Cloudflare usa para entregar os e-mails. A antiga para de funcionar. */
export async function gerarChaveEmails(): Promise<string> {
  const { data, error } = await supabase!.rpc('gerar_chave_email');
  if (error) throw new Error(/function|não existe|does not exist/i.test(error.message) ? 'Rode de novo o supabase/schema.sql no Supabase para criar a recepção de e-mails.' : error.message);
  return data as string;
}
const TABELA_DE = Object.fromEntries(TABELAS.map(([c, t]) => [t, c])) as Record<string, Colecao>;
const ID_CONFIG = 'escritorio';
const CHAVE_TEMA = 'spartacus:tema';

export type PapelPerfil = 'pendente' | 'advogado' | 'equipe' | 'cliente' | 'bloqueado';
export interface Perfil { auth_id: string; escritorio_id?: string | null; email: string; nome: string; papel: PapelPerfil; cpf?: string | null; criado_em?: string }

export interface EstadoNuvem {
  /** plataforma: só a equipe Spartacus, sem escritório; outroEscritorio: login de um escritório no endereço de outro */
  fase: 'carregando' | 'login' | 'novaSenha' | 'pendente' | 'pronto' | 'plataforma' | 'outroEscritorio' | 'erro';
  perfil?: Perfil;
  /** Equipe da plataforma (cria e acompanha escritórios) */
  ehPlataforma?: boolean;
  erro?: string;
  sync: 'ok' | 'salvando' | 'erro';
  syncErro?: string;
}

let est: EstadoNuvem = { fase: MODO_NUVEM ? 'carregando' : 'pronto', sync: 'ok' };
const ouvintes = new Set<() => void>();
function setEst(p: Partial<EstadoNuvem>) {
  est = { ...est, ...p };
  ouvintes.forEach((o) => o());
}

export function useNuvem(): EstadoNuvem {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => est);
}

// ---------- leitura ----------

async function buscarTudo(tabela: string): Promise<{ id: string; dados: any }[]> {
  const linhas: { id: string; dados: any }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase!.from(tabela).select('id,dados').order('id').range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...(data as any[]));
    if (!data || data.length < 1000) return linhas;
  }
}

function lerTema(): Config['tema'] {
  try {
    const t = localStorage.getItem(CHAVE_TEMA);
    if (t === 'claro' || t === 'escuro' || t === 'sistema') return t;
  } catch { /* sem armazenamento */ }
  return 'claro';
}

function perfisParaUsuarios(perfis: Perfil[]): Usuario[] {
  return perfis
    .filter((p) => p.papel === 'advogado' || p.papel === 'equipe' || p.papel === 'cliente')
    .map((p) => ({ id: p.auth_id, nome: p.nome || p.email, papel: p.papel as Usuario['papel'], cpf: p.cpf || undefined }));
}

async function listarPerfisDoEscritorio(eid: string): Promise<Perfil[]> {
  const { data, error } = await supabase!.from('perfis').select('*').eq('escritorio_id', eid).order('criado_em');
  if (error) throw new Error(error.message);
  return data as Perfil[];
}

/** Logins do escritório de quem está usando. */
export async function listarPerfis(): Promise<Perfil[]> {
  return listarPerfisDoEscritorio(escritorioId!);
}

/** Escritório de quem está logado (null no modo de testes ou para a equipe da plataforma). */
let escritorioId: string | null = null;
export const escritorioAtualId = () => escritorioId;

/** Marca do endereço aberto (antes do login). Sem escritório no endereço, fica a marca Spartacus. */
export async function carregarMarcaDoEndereco(): Promise<void> {
  if (!supabase || typeof location === 'undefined') return;
  const host = hostDoEscritorio(location, DOMINIO_PLATAFORMA);
  if (!host) return;
  const { data } = await supabase.rpc('marca_publica', { p_host: host });
  if (data) definirEscritorio(data as EscritorioPublico);
}

/** Recarrega os dados do escritório (marca, plano, implantação). */
export async function recarregarEscritorio(): Promise<EscritorioPublico | null> {
  if (!supabase || !escritorioId) return null;
  const { data, error } = await supabase.from('escritorios').select('*').eq('id', escritorioId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) definirEscritorio(data as EscritorioPublico);
  return data as EscritorioPublico | null;
}

/** Administrador do escritório: troca nome, logo e cores (white label). */
export async function salvarMarca(marca: EscritorioPublico['marca']) {
  const { error } = await supabase!.rpc('alterar_marca', { p_marca: marca });
  if (error) throw new Error(/alterar_marca|does not exist/i.test(error.message) ? 'Rode o supabase/schema.sql do Spartacus no Supabase.' : error.message);
  await recarregarEscritorio();
}

async function carregarDados(perfil: Perfil) {
  const base = bancoVazio();
  faltando.clear();
  const [colecoes, cfg, perfis, logs] = await Promise.all([
    Promise.all(TABELAS.map(([, t]) => (OPCIONAIS.has(t) ? buscarTudo(t).catch(() => { faltando.add(t); return []; }) : buscarTudo(t)))),
    supabase!.from('config').select('dados').eq('escritorio_id', perfil.escritorio_id!).eq('id', ID_CONFIG).maybeSingle(),
    listarPerfisDoEscritorio(perfil.escritorio_id!),
    supabase!.from('logs_cpf').select('*').order('em', { ascending: false }).limit(200),
  ]);
  TABELAS.forEach(([c], i) => { (base as any)[c] = colecoes[i].map((l) => l.dados); });
  base.config = { ...base.config, ...(cfg.data?.dados || {}), usuarioAtualId: perfil.auth_id, tema: lerTema() };
  base.usuarios = perfisParaUsuarios(perfis);
  base.logsCpf = (logs.data || []).map((l: any) => ({ em: l.em, usuarioId: l.auth_id, cpfMascarado: l.cpf_mascarado, resultado: l.resultado }));
  substituir(base);
}

export async function recarregarLogsCpf() {
  const { data } = await supabase!.from('logs_cpf').select('*').order('em', { ascending: false }).limit(200);
  substituir({ ...obter(), logsCpf: (data || []).map((l: any) => ({ em: l.em, usuarioId: l.auth_id, cpfMascarado: l.cpf_mascarado, resultado: l.resultado })) });
}

export async function recarregarUsuarios() {
  substituir({ ...obter(), usuarios: perfisParaUsuarios(await listarPerfis()) });
}

export async function alterarPerfil(authId: string, mudancas: Partial<Pick<Perfil, 'papel' | 'nome' | 'cpf'>>) {
  const { error } = await supabase!.from('perfis').update(mudancas).eq('auth_id', authId);
  if (error) throw new Error(error.message);
  await recarregarUsuarios();
}

// ---------- gravação ----------

const configCompartilhada = (c: Config) => {
  const { usuarioAtualId: _u, tema: _t, ...resto } = c;
  return resto;
};

let fila: Promise<void> = Promise.resolve();
let pendentes = 0;

function gravar(antes: Banco, depois: Banco) {
  if (depois.config.tema !== antes.config.tema) {
    try { localStorage.setItem(CHAVE_TEMA, depois.config.tema); } catch { /* sem armazenamento */ }
  }
  const operacoes: (() => Promise<void>)[] = [];
  const agora = new Date().toISOString();
  const eid = escritorioId;
  if (!eid) return;

  for (const [c, tabela] of TABELAS) {
    const a = antes[c] as { id: string }[];
    const d = depois[c] as { id: string }[];
    if (a === d || faltando.has(tabela)) continue;
    const anteriores = new Map(a.map((x) => [x.id, JSON.stringify(x)]));
    const mudou = d.filter((x) => anteriores.get(x.id) !== JSON.stringify(x));
    const idsDepois = new Set(d.map((x) => x.id));
    const removidos = a.filter((x) => !idsDepois.has(x.id)).map((x) => x.id);
    // Notificação nova para outra pessoa: só INSERT. O upsert também exige a regra de UPDATE,
    // que só o destinatário tem, e o banco recusaria.
    const soInserir = tabela === 'notificacoes' ? mudou.filter((x) => !anteriores.has(x.id)) : [];
    const atualizar = soInserir.length ? mudou.filter((x) => anteriores.has(x.id)) : mudou;
    const linhas = (xs: { id: string }[]) => xs.map((x) => ({ escritorio_id: eid, id: x.id, dados: x, atualizado_em: agora }));
    if (soInserir.length) {
      operacoes.push(async () => {
        const { error } = await supabase!.from(tabela).insert(linhas(soInserir));
        if (error) throw new Error(`${tabela}: ${error.message}`);
      });
    }
    if (atualizar.length) {
      operacoes.push(async () => {
        for (let i = 0; i < atualizar.length; i += 100) {
          const { error } = await supabase!.from(tabela).upsert(linhas(atualizar.slice(i, i + 100)), { onConflict: 'escritorio_id,id' });
          if (error) throw new Error(`${tabela}: ${error.message}`);
        }
      });
    }
    if (removidos.length) {
      operacoes.push(async () => {
        const { error } = await supabase!.from(tabela).delete().eq('escritorio_id', eid).in('id', removidos);
        if (error) throw new Error(`${tabela}: ${error.message}`);
      });
    }
  }

  const ca = JSON.stringify(configCompartilhada(antes.config));
  const cd = configCompartilhada(depois.config);
  if (ca !== JSON.stringify(cd)) {
    operacoes.push(async () => {
      const { error } = await supabase!.from('config').upsert({ escritorio_id: eid, id: ID_CONFIG, dados: cd, atualizado_em: agora }, { onConflict: 'escritorio_id,id' });
      if (error) throw new Error(`config: ${error.message}`);
    });
  }

  if (!operacoes.length) return;
  pendentes++;
  setEst({ sync: 'salvando' });
  // Em fila, para gravar na mesma ordem em que a pessoa alterou
  fila = fila
    .then(async () => { for (const op of operacoes) await op(); })
    .then(() => { pendentes--; if (!pendentes) setEst({ sync: 'ok', syncErro: undefined }); })
    .catch((e) => { pendentes--; setEst({ sync: 'erro', syncErro: String(e?.message || e) }); });
}

// ---------- tempo real ----------

function aplicarRemoto(tabela: string, payload: any) {
  // Exclusões chegam sem o filtro do Supabase: confere o escritório quando ele vem junto
  const eidEvento = payload.new?.escritorio_id ?? payload.old?.escritorio_id;
  if (eidEvento && eidEvento !== escritorioId) return;
  const atual = obter();
  if (tabela === 'config') {
    const dados = payload.new?.dados;
    if (dados) substituir({ ...atual, config: { ...atual.config, ...dados, usuarioAtualId: atual.config.usuarioAtualId, tema: atual.config.tema } });
    return;
  }
  const c = TABELA_DE[tabela];
  if (!c) return;
  const lista = atual[c] as { id: string }[];
  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    if (!lista.some((x) => x.id === id)) return;
    substituir({ ...atual, [c]: lista.filter((x) => x.id !== id) });
    return;
  }
  const dados = payload.new?.dados;
  if (!dados?.id) return;
  const i = lista.findIndex((x) => x.id === dados.id);
  if (i >= 0 && JSON.stringify(lista[i]) === JSON.stringify(dados)) return; // eco da própria gravação
  const nova = [...lista];
  if (i >= 0) nova[i] = dados; else nova.push(dados);
  substituir({ ...atual, [c]: nova });
}

let canal: ReturnType<SupabaseClient['channel']> | null = null;
function assinarTempoReal() {
  canal?.unsubscribe();
  canal = supabase!.channel(`escritorio-${escritorioId}`);
  for (const t of [...TABELAS.map(([, t]) => t), 'config']) {
    canal.on('postgres_changes' as any, { event: '*', schema: 'public', table: t, filter: `escritorio_id=eq.${escritorioId}` }, (p: any) => aplicarRemoto(t, p));
  }
  canal.subscribe();
}

// ---------- sessão ----------

let entrandoComo: string | null = null;

async function aoEntrar(sessao: Session) {
  if (entrandoComo === sessao.user.id) return; // o Supabase pode avisar o login duas vezes ao abrir
  entrandoComo = sessao.user.id;
  setEst({ fase: 'carregando' });
  try {
    const { data, error } = await supabase!.from('perfis').select('*').eq('auth_id', sessao.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    const perfil = (data as Perfil) || { auth_id: sessao.user.id, email: sessao.user.email || '', nome: sessao.user.email || '', papel: 'pendente' };
    const plat = await supabase!.from('plataforma_admins').select('auth_id').eq('auth_id', sessao.user.id).maybeSingle();
    const ehPlataforma = !plat.error && !!plat.data;
    const doEndereco = marcaAtual().escritorio;
    const temEscritorio = !!perfil.escritorio_id && (perfil.papel === 'advogado' || perfil.papel === 'equipe');
    if (!temEscritorio) {
      escritorioId = null;
      setEst({ fase: ehPlataforma ? 'plataforma' : 'pendente', perfil, ehPlataforma });
      return;
    }
    // Isolamento do white label: no endereço de um escritório só entra quem é dele
    if (doEndereco && doEndereco.id !== perfil.escritorio_id && !ehPlataforma) {
      setEst({ fase: 'outroEscritorio', perfil, ehPlataforma });
      return;
    }
    escritorioId = perfil.escritorio_id!;
    const esc = await recarregarEscritorio();
    if (!esc) {
      // Escritório suspenso ou cancelado: as regras do banco não deixam ler
      escritorioId = null;
      setEst({ fase: 'pendente', perfil, ehPlataforma });
      return;
    }
    await carregarDados(perfil);
    assinarTempoReal();
    setEst({ fase: 'pronto', perfil, ehPlataforma });
  } catch (e: any) {
    entrandoComo = null;
    setEst({ fase: 'erro', erro: e?.message || String(e) });
  }
}

let iniciado = false;
export function iniciarNuvem() {
  if (!supabase || iniciado) return;
  iniciado = true;
  registrarSincronizador(gravar);
  // Link de convite: depois de entrar, a pessoa escolhe a senha
  const convite = typeof location !== 'undefined' && /type=invite/.test(location.hash);
  // A marca do endereço vem antes do login (tela de entrada com logo e cores do escritório)
  void carregarMarcaDoEndereco().catch(() => {}).finally(() => ouvirSessao(convite));
}

function ouvirSessao(convite: boolean) {
  supabase!.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY' || (convite && evento === 'SIGNED_IN')) return setEst({ fase: 'novaSenha' });
    if (evento === 'SIGNED_OUT' || !sessao) {
      entrandoComo = null;
      escritorioId = null;
      canal?.unsubscribe();
      substituir(bancoVazio());
      return setEst({ fase: 'login', perfil: undefined });
    }
    if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
      if (est.fase === 'pronto' && est.perfil?.auth_id === sessao.user.id) return; // renovação de token
      // Fora do callback, como recomenda o Supabase
      setTimeout(() => aoEntrar(sessao), 0);
    }
  });
}

export async function entrar(email: string, senha: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
}

/** Primeiro acesso: cria o login com o e-mail liberado pelo escritório. Devolve false quando o Supabase exige confirmar o e-mail. */
export async function criarConta(email: string, senha: string): Promise<boolean> {
  const { data, error } = await supabase!.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin + '/' } });
  if (error) throw new Error(/registered|already/i.test(error.message) ? 'Este e-mail já tem senha. Clique em “Já tenho senha” ou em “Esqueci a senha”.' : error.message);
  return !!data.session;
}

// ---------- acessos liberados (convites) ----------

export interface AcessoAutorizado { email: string; nome: string; papel: 'advogado' | 'equipe' | 'cliente'; criado_em?: string }

export async function listarAcessos(): Promise<AcessoAutorizado[]> {
  const { data, error } = await supabase!.from('acessos_autorizados').select('email,nome,papel,criado_em').eq('escritorio_id', escritorioId!).order('criado_em');
  if (error) throw new Error(error.message);
  return data as AcessoAutorizado[];
}

/** Libera um e-mail no escritório. Se a pessoa já tiver login, entra direto; senão, cria a senha em “Primeiro acesso”. */
export async function autorizarAcesso(a: AcessoAutorizado) {
  const { error } = await supabase!.from('acessos_autorizados')
    .upsert({ escritorio_id: escritorioId, email: a.email.trim().toLowerCase(), nome: a.nome.trim(), papel: a.papel }, { onConflict: 'escritorio_id,email' });
  if (error) throw new Error(error.message);
  await recarregarUsuarios();
}

export async function removerAcesso(email: string) {
  const { error } = await supabase!.from('acessos_autorizados').delete().eq('escritorio_id', escritorioId!).eq('email', email);
  if (error) throw new Error(error.message);
}

export async function enviarRecuperacao(email: string) {
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' });
  if (error) throw new Error(error.message);
}

export async function definirNovaSenha(senha: string) {
  const { error } = await supabase!.auth.updateUser({ password: senha });
  if (error) throw new Error(error.message);
  const { data } = await supabase!.auth.getSession();
  if (data.session) {
    entrandoComo = null;
    await aoEntrar(data.session);
  }
}

export async function sair() {
  await supabase?.auth.signOut();
}

export async function tokenAtual(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ---------- plataforma (equipe Spartacus) ----------

export interface EscritorioPlataforma extends EscritorioPublico {
  situacao: 'implantacao' | 'ativo' | 'suspenso' | 'cancelado';
  plano: 'essencial' | 'profissional' | 'diamante';
  dominios: string[];
  modulos_desligados: string[];
  implantacao: Record<string, any>;
  whatsapp: { instancia?: string; destino?: string };
  criado_em: string;
}
export interface UsoEscritorio { id: string; usuarios: number; processos: number; clientes: number; tarefas: number; ultimo_uso: string | null }

export async function listarEscritorios(): Promise<{ escritorios: EscritorioPlataforma[]; uso: Map<string, UsoEscritorio> }> {
  const [e, u] = await Promise.all([
    supabase!.from('escritorios').select('*').order('criado_em', { ascending: false }),
    supabase!.rpc('plataforma_resumo'),
  ]);
  if (e.error) throw new Error(e.error.message);
  return { escritorios: e.data as EscritorioPlataforma[], uso: new Map(((u.data as UsoEscritorio[]) || []).map((x) => [x.id, x])) };
}

export async function criarEscritorio(d: {
  slug: string; nome: string; marca: EscritorioPublico['marca']; plano: string; adminEmail: string; adminNome: string; oabs: { numero: string; uf: string }[];
}): Promise<string> {
  const { data, error } = await supabase!.rpc('plataforma_criar_escritorio', {
    p_slug: d.slug, p_nome: d.nome, p_marca: d.marca, p_plano: d.plano, p_admin_email: d.adminEmail, p_admin_nome: d.adminNome, p_oabs: d.oabs,
  });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Este endereço (subdomínio) já está em uso.' : error.message);
  return data as string;
}

export async function atualizarEscritorio(id: string, mudancas: Partial<Pick<EscritorioPlataforma, 'situacao' | 'plano' | 'dominios' | 'modulos_desligados' | 'implantacao' | 'whatsapp' | 'marca' | 'nome'>>) {
  const { error } = await supabase!.from('escritorios').update(mudancas).eq('id', id);
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Domínio já usado por outro escritório.' : error.message);
  if (id === escritorioId) await recarregarEscritorio();
}
