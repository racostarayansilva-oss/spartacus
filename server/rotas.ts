// Tabela de rotas da API. Usada pela função da Vercel (api/router.ts) e pelo servidor de desenvolvimento (vite.config.ts).

import { ErroApi, Resposta, env, ok } from './http.js';
import { autenticar, exigirAdministrador, exigirEquipe, Sessao, supabaseConfigurado, supabaseRest } from './auth.js';
import { processoPorNumero } from './integracoes/datajud.js';
import { geminiConfigurado, resumirProcesso as geminiResumir } from './integracoes/gemini.js';
import { deepseekConfigurado, resumirProcesso as deepseekResumir, resumirFala } from './integracoes/deepseek.js';
import { crmConfigurado, sessaoCrm } from './integracoes/crm.js';
import { comunicacoesPorOab, paginaComunicacoes } from './integracoes/djen.js';
import { indiceNorma, senadoNorma, textoArtigo, textoCompleto } from './integracoes/normas.js';
import { buscarNoCatalogo, detalheNorma, infoCatalogo } from './integracoes/catalogoNormas.js';
import type { TipoNorma } from '../src/lib/buscaNormas.js';
import { camara, carf, stj, tcu, tst } from './integracoes/jurisprudencia.js';
import { processosPorCpf, provedoresCpfConfigurados } from './integracoes/cpf.js';
import { receberEmail } from './integracoes/email.js';
import { cpfValido, mascararCpf, somenteDigitos } from '../src/lib/cpf.js';

export interface Requisicao {
  metodo: string;
  caminho: string; // sem o prefixo /api, ex.: "processo/0000000-00.0000.0.00.0000"
  query: Record<string, string>;
  corpo: any;
  usuario?: string;
  /** Cabeçalho Authorization (Bearer <token do Supabase>) */
  autorizacao?: string;
}

type Handler = (req: Requisicao, params: string[], sessao: Sessao | null) => Promise<Resposta>;

/** Regras de acesso da consulta por CPF, conferidas no servidor quando há login. */
async function conferirAcessoCpf(sessao: Sessao | null, cpf: string) {
  if (!sessao) return; // modo local de testes
  if (sessao.papel === 'cliente') {
    if (somenteDigitos(sessao.cpf || '') !== cpf) throw new ErroApi(403, 'Cliente só pode consultar o próprio CPF.');
    return;
  }
  const clientes = await supabaseRest(sessao, `clientes?select=dados&dados->>cpf=eq.${cpf}`);
  if (!clientes?.length) throw new ErroApi(403, 'Este CPF não é de um cliente cadastrado no escritório.');
  if (sessao.papel === 'equipe' && !clientes.some((c: any) => c.dados?.responsavelId === sessao.id)) {
    throw new ErroApi(403, 'Este cliente está sob responsabilidade de outra pessoa.');
  }
}

async function registrarLogCpf(sessao: Sessao | null, cpf: string, resultado: string) {
  if (!sessao) return;
  try {
    await supabaseRest(sessao, 'logs_cpf', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ usuario_nome: sessao.nome, cpf_mascarado: mascararCpf(cpf), resultado: resultado.slice(0, 300) }),
    });
  } catch (e) {
    console.error('Falha ao gravar log de CPF', e);
  }
}

const rotaCpf: Handler = async (r, _p, sessao) => {
  const cpf = somenteDigitos(r.corpo?.cpf);
  if (!cpfValido(cpf)) throw new ErroApi(400, 'CPF inválido (dígitos verificadores não conferem).');
  await conferirAcessoCpf(sessao, cpf);
  try {
    const res = await processosPorCpf(cpf, sessao?.nome || r.usuario || '');
    await registrarLogCpf(sessao, cpf, `${res.processos.length} processo(s) via ${res.provedor}`);
    return ok(res);
  } catch (e: any) {
    await registrarLogCpf(sessao, cpf, 'erro: ' + (e?.message || e));
    throw e;
  }
};

const rotas: [string, RegExp, Handler, 'aberta' | 'equipe' | 'logado' | 'administrador'][] = [
  ['GET', /^status$/, async () =>
    ok({
      login: { configurado: !!supabaseConfigurado() },
      datajud: { configurado: true, chavePropria: !!env('DATAJUD_API_KEY') },
      djen: { configurado: true },
      normas: { configurado: true },
      senado: { configurado: true },
      tst: { configurado: true },
      tcu: { configurado: true },
      carf: { configurado: true },
      camara: { configurado: true },
      stj: { configurado: true },
      gemini: { configurado: geminiConfigurado() },
      deepseek: { configurado: deepseekConfigurado() },
      crm: { configurado: crmConfigurado() },
      cpf: { configurado: provedoresCpfConfigurados().length > 0 && env('CPF_CONSULTA_HABILITADA') === '1', provedores: provedoresCpfConfigurados() },
    }), 'administrador'],
  // Chamada pelo Email Worker do Cloudflare; a chave é conferida no banco (função receber_email)
  ['POST', /^email\/entrada$/, async (r) => ok(await receberEmail(r.corpo)), 'aberta'],
  ['GET', /^processo\/(.+)$/, async (_r, [numero]) => ok(await processoPorNumero(decodeURIComponent(numero))), 'equipe'],
  ['POST', /^cpf$/, rotaCpf, 'logado'],
  ['POST', /^ia\/resumo-processo$/, async (r) => {
    if (deepseekConfigurado()) return ok(await deepseekResumir(r.corpo?.dados));
    if (geminiConfigurado()) return ok(await geminiResumir(r.corpo?.dados));
    throw new ErroApi(503, 'Nenhuma IA configurada. Cadastre DEEPSEEK_API_KEY ou GEMINI_API_KEY.');
  }, 'equipe'],
  ['POST', /^ia\/resumir-fala$/, async (r) => {
    if (!deepseekConfigurado()) throw new ErroApi(503, 'Resumo por IA desligado: cadastre DEEPSEEK_API_KEY na Vercel.');
    return ok(await resumirFala(r.corpo?.texto));
  }, 'equipe'],
  ['POST', /^crm\/sessao$/, async (_r, _p, sessao) => {
    if (!sessao) throw new ErroApi(503, 'O CRM exige login do Spartacus (Supabase).');
    return ok(await sessaoCrm(sessao.email));
  }, 'equipe'],
  ['GET', /^publicacoes\/pagina$/, async (r) =>
    ok(await paginaComunicacoes(r.query.oab, r.query.uf, r.query.inicio, r.query.fim, Number(r.query.pagina) || 1)), 'equipe'],
  ['GET', /^publicacoes$/, async (r) => {
    const hoje = new Date().toISOString().slice(0, 10);
    return ok(await comunicacoesPorOab(r.query.oab, r.query.uf, r.query.inicio || hoje, r.query.fim || hoje));
  }, 'equipe'],
  ['GET', /^normas\/info$/, async () => ok(infoCatalogo()), 'equipe'],
  ['GET', /^normas\/busca$/, async (r) =>
    ok(buscarNoCatalogo(r.query.q, { tipo: (r.query.tipo || '') as TipoNorma | '', desde: r.query.desde, ate: r.query.ate }, Math.max(1, Number(r.query.pagina) || 1))), 'equipe'],
  ['GET', /^normas\/detalhe$/, async (r) => ok(await detalheNorma(r.query.id)), 'equipe'],
  ['GET', /^norma\/texto$/, async (r) => ok(await textoCompleto(r.query.urn)), 'equipe'],
  ['GET', /^norma\/indice$/, async (r) => ok(await indiceNorma(r.query.urn)), 'equipe'],
  ['GET', /^norma$/, async (r) => ok(await textoArtigo(r.query.urn, r.query.art)), 'equipe'],
  ['GET', /^senado\/norma$/, async (r) => ok(await senadoNorma(r.query.urn)), 'equipe'],
  ['GET', /^tst$/, async (r) => ok(await tst(r.query.q)), 'equipe'],
  ['GET', /^tcu$/, async (r) => ok(await tcu(r.query.q)), 'equipe'],
  ['GET', /^carf$/, async (r) => ok(await carf(r.query.processo)), 'equipe'],
  ['GET', /^camara$/, async (r) => ok(await camara(r.query.q)), 'equipe'],
  ['GET', /^stj$/, async (r) => ok(await stj(r.query.q)), 'equipe'],
];

export async function atender(req: Requisicao): Promise<Resposta> {
  const caminho = req.caminho.replace(/^\/+|\/+$/g, '');
  try {
    for (const [metodo, re, h, acesso] of rotas) {
      const m = caminho.match(re);
      if (!m || metodo !== req.metodo.toUpperCase()) continue;
      const sessao = acesso === 'aberta' ? null : await autenticar(req.autorizacao);
      if (acesso === 'equipe') exigirEquipe(sessao);
      if (acesso === 'administrador') exigirAdministrador(sessao);
      return await h(req, m.slice(1), sessao);
    }
    return { status: 404, body: { erro: `Rota não encontrada: ${req.metodo} /api/${caminho}` } };
  } catch (e: any) {
    if (e instanceof ErroApi) return { status: e.status, body: { erro: e.message, detalhe: e.detalhe } };
    console.error(e);
    return { status: 500, body: { erro: 'Erro interno' } };
  }
}
