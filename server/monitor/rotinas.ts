// Rotinas do monitor automático (só no servidor próprio):
// Camada 1 — DJEN: intimações novas pelas OABs do escritório e cadastro dos processos que faltam.
// Camada 2 — DataJud: andamentos novos dos processos cadastrados, em lotes de até 50 por tribunal.
import { randomUUID } from 'node:crypto';
import type { Cliente, Intimacao, Processo } from '../../src/store.js';
import { aliasDataJud, cnjValido, parseCnj } from '../../src/lib/cnj.js';
import { somarDias } from '../../src/lib/datas.js';
import { aplicarComunicacoes, aplicarDataJud, Aviso, destinatarios, notificacaoDoAviso, RELEVANTE } from '../../src/lib/monitor.js';
import { comunicacoesPorOab, Comunicacao } from '../integracoes/djen.js';
import { processosEmLote } from '../integracoes/datajud.js';
import { env, esperar } from '../http.js';
import { administradores, gravarColecao, gravarEstado, lerColecao, lerConfig, lerIds } from './banco.js';
import { enviarWhatsapp } from './whatsapp.js';

export type Rotina = 'djen' | 'datajud';
export interface Resumo { [chave: string]: number | string | boolean | undefined }

const novoId = () => randomUUID().replace(/-/g, '').slice(0, 14);
/** Data de hoje em Belém (o servidor roda em UTC). */
export const hojeBrasil = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' });
const dataBr = (d: string) => String(d).slice(0, 10).split('-').reverse().join('/');
const site = () => env('ORIGEM_APP') || 'https://racostaconnect.com';

/** Sino de cada destinatário + um resumo no WhatsApp da equipe. */
async function avisar(avisos: Aviso[], processos: Map<string, Processo>, cabecalho: string): Promise<{ notificacoes: number; whatsapp: boolean; erroWhatsapp?: string }> {
  if (!avisos.length) return { notificacoes: 0, whatsapp: false };
  const admins = await administradores();
  const agora = new Date().toISOString();
  const notificacoes = avisos.flatMap((a) => destinatarios(processos.get(a.processoId), admins).map((id) => notificacaoDoAviso(a, id, novoId, agora)));
  await gravarColecao('notificacoes', notificacoes);
  const ordem = [...avisos].sort((a, b) => Number(b.relevante) - Number(a.relevante));
  const linhas = ordem.slice(0, 15).map((a) => `• *${a.titulo}*\n  ${a.texto.slice(0, 160)}`);
  const resto = avisos.length > 15 ? `\n…e mais ${avisos.length - 15}.` : '';
  try {
    const enviado = await enviarWhatsapp(`*RA Connect — ${cabecalho}*\n\n${linhas.join('\n')}${resto}\n\n${site()}/controladoria`);
    return { notificacoes: notificacoes.length, whatsapp: enviado };
  } catch (e: any) {
    return { notificacoes: notificacoes.length, whatsapp: false, erroWhatsapp: String(e?.message || e).slice(0, 200) };
  }
}

export async function rodarDjen(diasAtras = 2): Promise<Resumo> {
  const config = await lerConfig();
  const oabs: { numero: string; uf: string }[] = config.oabs || [];
  if (!oabs.length) return { aviso: 'Nenhuma OAB cadastrada em Configurações.' };
  const fim = hojeBrasil();
  const inicio = somarDias(fim, -diasAtras);
  const comunicacoes: Comunicacao[] = [];
  for (const o of oabs) {
    comunicacoes.push(...(await comunicacoesPorOab(o.numero, o.uf, inicio, fim)));
    await esperar(3500); // o DJEN aceita 20 consultas por minuto
  }
  const [processos, clientes, intimacoesIds] = await Promise.all([
    lerColecao<Processo>('processos'), lerColecao<Cliente>('clientes'), lerIds('intimacoes'),
  ]);
  const r = aplicarComunicacoes({ processos, clientes, intimacoesIds }, comunicacoes, novoId);
  await gravarColecao('clientes', r.clientesNovos);
  await gravarColecao('processos', [...r.processosNovos, ...r.processosAlterados]);
  await gravarColecao('intimacoes', r.intimacoes as Intimacao[]);
  const mapa = new Map([...processos, ...r.processosNovos].map((p) => [p.id, p]));
  const aviso = await avisar(r.avisos, mapa, `${r.intimacoes.length} intimação(ões) nova(s) no DJEN`);
  return {
    periodo: `${dataBr(inicio)} a ${dataBr(fim)}`, comunicacoes: comunicacoes.length, intimacoesNovas: r.intimacoes.length,
    processosNovos: r.processosNovos.length, clientesNovos: r.clientesNovos.length, ...aviso,
  };
}

export async function rodarDataJud(): Promise<Resumo> {
  const [processos, clientes] = await Promise.all([lerColecao<Processo>('processos'), lerColecao<Cliente>('clientes')]);
  const nomes = new Map(clientes.map((c) => [c.id, c.nome]));
  const porTribunal = new Map<string, Processo[]>();
  for (const p of processos) {
    if (!cnjValido(p.numero)) continue;
    const alias = aliasDataJud(p.numero);
    if (alias) porTribunal.set(alias, [...(porTribunal.get(alias) || []), p]);
  }
  const agora = new Date().toISOString();
  const alterados: Processo[] = [];
  const avisos: Aviso[] = [];
  let consultados = 0, encontrados = 0, falhas = 0;
  for (const [alias, lista] of porTribunal) {
    for (let i = 0; i < lista.length; i += 50) {
      const lote = lista.slice(i, i + 50);
      consultados += lote.length;
      let mapa;
      try { mapa = await processosEmLote(alias, lote.map((p) => p.numero)); } catch { falhas += lote.length; continue; }
      for (const p of lote) {
        const r = mapa.get(parseCnj(p.numero)!.digitos);
        if (!r) continue;
        encontrados++;
        const res = aplicarDataJud(p, r, agora);
        if (res.mudou) alterados.push(res.processo);
        if (!res.novos.length) continue;
        const ultimos = res.novos.slice(0, 3).map((m) => `${dataBr(m.data)} ${m.nome}${m.complemento ? ` (${m.complemento})` : ''}`);
        avisos.push({
          processoId: p.id, relevante: res.novos.some((m) => RELEVANTE.test(m.nome)),
          titulo: `Andamento: ${nomes.get(p.clienteId) || p.numero}`,
          texto: ultimos.join('; ') + (res.novos.length > 3 ? ` e mais ${res.novos.length - 3}` : ''),
        });
      }
      await esperar(2000);
    }
  }
  await gravarColecao('processos', alterados);
  const aviso = await avisar(avisos, new Map(processos.map((p) => [p.id, p])), `${avisos.length} processo(s) com andamento novo`);
  return { consultados, encontrados, naoIndexados: consultados - encontrados - falhas, falhas, atualizados: alterados.length, comAndamentoNovo: avisos.length, ...aviso };
}

const rodando = new Set<Rotina>();

/** Executa uma rotina (uma de cada vez) e grava o resultado para a tela da Controladoria. */
export async function executar(rotina: Rotina, origem: 'agenda' | 'manual'): Promise<void> {
  if (rodando.has(rotina)) return;
  rodando.add(rotina);
  const inicio = new Date().toISOString();
  try {
    await gravarEstado(rotina, { situacao: 'rodando', inicio, origem });
    const resumo = rotina === 'djen' ? await rodarDjen() : await rodarDataJud();
    await gravarEstado(rotina, { situacao: 'ok', inicio, fim: new Date().toISOString(), origem, resumo });
    console.log(`[monitor] ${rotina} ok`, JSON.stringify(resumo));
  } catch (e: any) {
    const erro = String(e?.message || e).slice(0, 300);
    console.error(`[monitor] ${rotina} falhou:`, erro);
    await gravarEstado(rotina, { situacao: 'erro', inicio, fim: new Date().toISOString(), origem, erro }).catch(() => {});
  } finally {
    rodando.delete(rotina);
  }
}

export const estaRodando = (r: Rotina) => rodando.has(r);
