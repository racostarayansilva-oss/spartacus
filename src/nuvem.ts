// Ligação com o Supabase: login, carregamento dos dados, gravação das alterações e tempo real.
// Só é usado quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas.

import { useSyncExternalStore } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
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
const CHAVE_TEMA = 'ra-connect:tema';

export type PapelPerfil = 'pendente' | 'advogado' | 'equipe' | 'cliente' | 'bloqueado';
export interface Perfil { auth_id: string; email: string; nome: string; papel: PapelPerfil; cpf?: string | null; criado_em?: string }

export interface EstadoNuvem {
  fase: 'carregando' | 'login' | 'novaSenha' | 'pendente' | 'pronto' | 'erro';
  perfil?: Perfil;
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
  return 'escuro';
}

function perfisParaUsuarios(perfis: Perfil[]): Usuario[] {
  return perfis
    .filter((p) => p.papel === 'advogado' || p.papel === 'equipe' || p.papel === 'cliente')
    .map((p) => ({ id: p.auth_id, nome: p.nome || p.email, papel: p.papel as Usuario['papel'], cpf: p.cpf || undefined }));
}

export async function listarPerfis(): Promise<Perfil[]> {
  const { data, error } = await supabase!.from('perfis').select('*').order('criado_em');
  if (error) throw new Error(error.message);
  return data as Perfil[];
}

async function carregarDados(perfil: Perfil) {
  const base = bancoVazio();
  faltando.clear();
  const [colecoes, cfg, perfis, logs] = await Promise.all([
    Promise.all(TABELAS.map(([, t]) => (OPCIONAIS.has(t) ? buscarTudo(t).catch(() => { faltando.add(t); return []; }) : buscarTudo(t)))),
    supabase!.from('config').select('dados').eq('id', ID_CONFIG).maybeSingle(),
    listarPerfis(),
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
    const linhas = (xs: { id: string }[]) => xs.map((x) => ({ id: x.id, dados: x, atualizado_em: agora }));
    if (soInserir.length) {
      operacoes.push(async () => {
        const { error } = await supabase!.from(tabela).insert(linhas(soInserir));
        if (error) throw new Error(`${tabela}: ${error.message}`);
      });
    }
    if (atualizar.length) {
      operacoes.push(async () => {
        for (let i = 0; i < atualizar.length; i += 100) {
          const { error } = await supabase!.from(tabela).upsert(linhas(atualizar.slice(i, i + 100)));
          if (error) throw new Error(`${tabela}: ${error.message}`);
        }
      });
    }
    if (removidos.length) {
      operacoes.push(async () => {
        const { error } = await supabase!.from(tabela).delete().in('id', removidos);
        if (error) throw new Error(`${tabela}: ${error.message}`);
      });
    }
  }

  const ca = JSON.stringify(configCompartilhada(antes.config));
  const cd = configCompartilhada(depois.config);
  if (ca !== JSON.stringify(cd)) {
    operacoes.push(async () => {
      const { error } = await supabase!.from('config').upsert({ id: ID_CONFIG, dados: cd, atualizado_em: agora });
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
  canal = supabase!.channel('ra-connect');
  for (const t of [...TABELAS.map(([, t]) => t), 'config']) {
    canal.on('postgres_changes' as any, { event: '*', schema: 'public', table: t }, (p: any) => aplicarRemoto(t, p));
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
    if (perfil.papel !== 'advogado' && perfil.papel !== 'equipe') {
      setEst({ fase: 'pendente', perfil });
      return;
    }
    await carregarDados(perfil);
    assinarTempoReal();
    setEst({ fase: 'pronto', perfil });
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
  supabase.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY') return setEst({ fase: 'novaSenha' });
    if (evento === 'SIGNED_OUT' || !sessao) {
      entrandoComo = null;
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
