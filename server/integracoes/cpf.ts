// Processos em que um CPF é parte. Serviços pagos: Judit, Escavador, Vigilant, Jusneural.
// O DataJud NÃO busca por CPF, por isso é preciso contratar pelo menos um destes.
// Processos em segredo de justiça são removidos da resposta.

import { cpfValido, mascararCpf, somenteDigitos } from '../../src/lib/cpf.js';
import { ErroApi, buscarJson, env, esperar } from '../http.js';

export interface ProcessoCpf {
  numero: string;
  tribunal?: string;
  classe?: string;
  assunto?: string;
  polo?: string;
  ultimaMovimentacao?: string;
  dataUltimaMovimentacao?: string;
  sigiloso?: boolean;
}

export interface ResultadoCpf {
  provedor: string;
  cpf: string;
  processos: ProcessoCpf[];
  removidosPorSigilo: number;
}

type Provedor = (cpf: string) => Promise<ProcessoCpf[]>;

const judit: Provedor = async (cpf) => {
  const chave = env('JUDIT_API_KEY');
  const headers = { 'api-key': chave, 'Content-Type': 'application/json' };
  const pedido = await buscarJson('https://requests.prod.judit.io/requests', {
    method: 'POST',
    headers,
    body: JSON.stringify({ search: { search_type: 'cpf', search_key: cpf } }),
  });
  const id = pedido?.request_id;
  if (!id) throw new ErroApi(502, 'Judit não devolveu request_id.');
  // Requisição assíncrona: acompanha até concluir (até ~50 s).
  for (let i = 0; i < 25; i++) {
    await esperar(2000);
    const st = await buscarJson(`https://requests.prod.judit.io/requests/${id}`, { headers });
    if (st?.status === 'completed') break;
    if (i === 24) throw new ErroApi(504, 'Judit ainda processando; tente de novo em instantes.');
  }
  const resp = await buscarJson(`https://requests.prod.judit.io/responses?request_id=${id}&page_size=100`, { headers });
  return (resp?.page_data || []).map((r: any) => {
    const d = r.response_data || r;
    const ult = (d.steps || [])[0];
    return {
      numero: d.code || d.lawsuit_code || '',
      tribunal: d.tribunal_acronym || d.court,
      classe: d.classifications?.[0]?.name,
      assunto: d.subjects?.[0]?.name,
      polo: d.parties?.find((p: any) => somenteDigitos(p.main_document || '') === cpf)?.side,
      ultimaMovimentacao: ult?.content,
      dataUltimaMovimentacao: ult?.step_date,
      sigiloso: Boolean(d.secrecy_level && Number(d.secrecy_level) > 0),
    };
  });
};

const escavador: Provedor = async (cpf) => {
  const dados = await buscarJson(`https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpf}`, {
    headers: { Authorization: `Bearer ${env('ESCAVADOR_TOKEN')}`, 'X-Requested-With': 'XMLHttpRequest' },
  });
  return (dados?.items || []).map((p: any) => {
    const fonte = (p.fontes || [])[0] || {};
    return {
      numero: p.numero_cnj,
      tribunal: fonte.sigla || fonte.tribunal?.sigla,
      classe: fonte.capa?.classe,
      assunto: fonte.capa?.assunto,
      ultimaMovimentacao: p.ultima_movimentacao?.conteudo,
      dataUltimaMovimentacao: p.data_ultima_movimentacao,
      sigiloso: Boolean(fonte.segredo_justica),
    };
  });
};

const vigilant: Provedor = async (cpf) => {
  const base = env('VIGILANT_URL');
  if (!base) throw new ErroApi(500, 'VIGILANT_URL não configurada.');
  const dados = await buscarJson(`${base.replace(/\/$/, '')}/api/v1/consults`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('VIGILANT_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: cpf, type: 'cpf' }),
  });
  return (dados?.processes || dados?.data || []).map((p: any) => ({
    numero: p.number || p.numero,
    tribunal: p.court || p.tribunal,
    classe: p.class || p.classe,
    sigiloso: Boolean(p.secret || p.segredo_justica),
  }));
};

const jusneural: Provedor = async (cpf) => {
  const dados = await buscarJson('https://app.jusneural.com/api/api-jusneural/consultar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('JUSNEURAL_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf }),
    timeoutMs: 120_000,
  });
  return (dados?.processos || dados?.data || []).map((p: any) => ({
    numero: p.numero || p.numero_processo,
    tribunal: p.tribunal,
    classe: p.classe,
    sigiloso: Boolean(p.segredo_justica || p.sigilo),
  }));
};

const PROVEDORES: Record<string, { fn: Provedor; configurado: () => boolean }> = {
  judit: { fn: judit, configurado: () => !!env('JUDIT_API_KEY') },
  escavador: { fn: escavador, configurado: () => !!env('ESCAVADOR_TOKEN') },
  vigilant: { fn: vigilant, configurado: () => !!env('VIGILANT_TOKEN') && !!env('VIGILANT_URL') },
  jusneural: { fn: jusneural, configurado: () => !!env('JUSNEURAL_TOKEN') },
};

export function provedoresCpfConfigurados(): string[] {
  return Object.entries(PROVEDORES).filter(([, p]) => p.configurado()).map(([n]) => n);
}

export async function processosPorCpf(cpfBruto: string, usuario: string): Promise<ResultadoCpf> {
  const cpf = somenteDigitos(cpfBruto);
  if (!cpfValido(cpf)) throw new ErroApi(400, 'CPF inválido (dígitos verificadores não conferem).');
  if (env('CPF_CONSULTA_HABILITADA') !== '1') {
    throw new ErroApi(503, 'Consulta por CPF desligada. Contrate um provedor e defina CPF_CONSULTA_HABILITADA=1.');
  }
  const ordem = (env('CPF_PROVEDORES') || 'judit,escavador,vigilant,jusneural').split(',').map((s) => s.trim());
  const disponiveis = ordem.filter((n) => PROVEDORES[n]?.configurado());
  if (!disponiveis.length) throw new ErroApi(503, 'Nenhum provedor de consulta por CPF configurado.');

  // Registro de auditoria (LGPD): quem consultou, quando e qual CPF (mascarado).
  console.log(JSON.stringify({ evento: 'consulta_cpf', usuario: usuario || 'desconhecido', cpf: mascararCpf(cpf), em: new Date().toISOString() }));

  let ultimoErro: unknown;
  for (const nome of disponiveis) {
    try {
      const todos = await PROVEDORES[nome].fn(cpf);
      const visiveis = todos.filter((p) => !p.sigiloso && p.numero);
      return { provedor: nome, cpf: mascararCpf(cpf), processos: visiveis, removidosPorSigilo: todos.length - visiveis.length };
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro instanceof ErroApi ? ultimoErro : new ErroApi(502, 'Todos os provedores falharam.');
}
