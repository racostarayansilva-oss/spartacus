// DataJud (CNJ): capa e movimentações pelo número CNJ. Não busca por CPF.
// https://datajud-wiki.cnj.jus.br/api-publica/

import { aliasDataJud, cnjValido, parseCnj } from '../../src/lib/cnj.js';
import { ErroApi, buscarJson, env, esperar } from '../http.js';

// Chave pública divulgada pelo CNJ na wiki do DataJud. Use DATAJUD_API_KEY para trocar quando o CNJ atualizar.
const CHAVE_PUBLICA_PADRAO = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

export interface ProcessoDataJud {
  numero: string;
  tribunal: string;
  classe?: string;
  orgaoJulgador?: string;
  dataAjuizamento?: string;
  assuntos: string[];
  sigiloso: boolean;
  movimentos: { data: string; nome: string; complemento?: string }[];
  ultimaAtualizacao?: string;
  grau?: string;
  /** Valor da causa, quando o tribunal manda esse campo ao DataJud (a maioria não manda) */
  valorCausa?: number;
}

/** Procura um campo de valor da causa na capa (o nome varia; a API pública em geral não traz). */
function acharValorCausa(fonte: any): number | undefined {
  for (const [k, v] of Object.entries(fonte || {})) {
    if (!/valor.*causa|causa.*valor|^valor$/i.test(k)) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export async function processoPorNumero(numero: string): Promise<ProcessoDataJud> {
  const cnj = parseCnj(numero);
  if (!cnj) throw new ErroApi(400, 'Número CNJ deve ter 20 dígitos.');
  if (!cnjValido(numero)) throw new ErroApi(400, 'Dígito verificador do número CNJ não confere.');
  const alias = aliasDataJud(numero);
  if (!alias) throw new ErroApi(400, `Tribunal não suportado (J=${cnj.justica}, TR=${cnj.tribunal}).`);

  const chave = env('DATAJUD_API_KEY') || CHAVE_PUBLICA_PADRAO;
  const dados = await buscarJson(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
    method: 'POST',
    headers: { Authorization: `APIKey ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso: cnj.digitos } }, size: 10 }),
    // O DataJud do CNJ tem levado 30–40 s para responder; a função da Vercel tem até 60 s.
    timeoutMs: 55_000,
  });

  const hits: any[] = dados?.hits?.hits || [];
  if (!hits.length) throw new ErroApi(404, `Processo não encontrado no DataJud (${alias}).`);
  return converter(hits.map((h) => h._source), cnj.formatado, alias);
}

/** Junta os registros do mesmo processo (um por grau) numa capa só, com as movimentações de todos. */
function converter(fontes: any[], numero: string, alias: string): ProcessoDataJud {
  const principal = [...fontes].sort((a, b) => String(b.dataHoraUltimaAtualizacao || '').localeCompare(String(a.dataHoraUltimaAtualizacao || '')))[0];
  const movimentos = fontes
    .flatMap((s) => s.movimentos || [])
    .map((m: any) => ({
      data: m.dataHora,
      nome: m.nome,
      complemento: (m.complementosTabelados || []).map((c: any) => c.nome || c.descricao).filter(Boolean).join('; ') || undefined,
    }))
    .sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)));

  return {
    numero,
    tribunal: principal.tribunal || alias.toUpperCase(),
    classe: principal.classe?.nome,
    orgaoJulgador: principal.orgaoJulgador?.nome,
    dataAjuizamento: principal.dataAjuizamento,
    assuntos: (principal.assuntos || []).map((a: any) => a.nome).filter(Boolean),
    sigiloso: Number(principal.nivelSigilo || 0) > 0,
    movimentos,
    ultimaAtualizacao: principal.dataHoraUltimaAtualizacao,
    grau: principal.grau,
    valorCausa: fontes.map(acharValorCausa).find((v) => v !== undefined),
  };
}

/**
 * Até 50 processos do mesmo tribunal numa consulta só (monitor automático).
 * O CNJ recusa com 'es_rejected_execution_exception' quando está sobrecarregado: tenta de novo com espera.
 * Devolve só os encontrados, pelos 20 dígitos.
 */
export async function processosEmLote(alias: string, numeros: string[], tentativas = 4): Promise<Map<string, ProcessoDataJud>> {
  const digitos = [...new Set(numeros.map((n) => parseCnj(n)?.digitos).filter(Boolean) as string[])].slice(0, 50);
  const resultado = new Map<string, ProcessoDataJud>();
  if (!digitos.length) return resultado;
  const chave = env('DATAJUD_API_KEY') || CHAVE_PUBLICA_PADRAO;
  let dados: any;
  for (let t = 1; ; t++) {
    try {
      dados = await buscarJson(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
        method: 'POST',
        headers: { Authorization: `APIKey ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { terms: { numeroProcesso: digitos } }, size: digitos.length * 4 }),
        timeoutMs: 90_000,
      });
      if (dados?.hits) break;
      throw new Error(JSON.stringify(dados?.error || dados).slice(0, 200));
    } catch (e) {
      if (t >= tentativas) throw e;
      await esperar(15_000 * t);
    }
  }
  const porNumero = new Map<string, any[]>();
  for (const h of dados.hits.hits || []) {
    const n = String(h._source?.numeroProcesso || '');
    porNumero.set(n, [...(porNumero.get(n) || []), h._source]);
  }
  for (const [n, fontes] of porNumero) resultado.set(n, converter(fontes, parseCnj(n)?.formatado || n, alias));
  return resultado;
}
