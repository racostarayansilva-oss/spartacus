// Jurisprudência e dados abertos: TST, TCU, CARF, Câmara e STJ.
// Contratos conforme o projeto aberto br-eli-mcp (confirmado em jul/2026).

import { ErroApi, buscarJson, env } from '../http.js';

/** "ALEXANDRE LUIZ RAMOS" → "Alexandre Luiz Ramos" */
const nomeProprio = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && ['da', 'de', 'do', 'das', 'dos', 'e'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

function termo(q: string) {
  const t = (q || '').trim();
  if (t.length < 3) throw new ErroApi(400, 'Digite pelo menos 3 caracteres.');
  return t.slice(0, 200);
}

// O TST publica o endereço do serviço de busca em https://jurisprudencia.tst.jus.br/config.json ("base_url").
// Em nov/2026 ele mudou de jurisprudencia-backend2 para jurisprudencia-backend; lemos de lá para acompanhar.
let baseTst: { url: string; em: number } | null = null;
async function enderecoTst(): Promise<string> {
  const fixo = env('TST_BASE');
  if (fixo) return fixo.replace(/\/$/, '');
  if (baseTst && Date.now() - baseTst.em < 6 * 3600_000) return baseTst.url;
  try {
    const cfg = await buscarJson('https://jurisprudencia.tst.jus.br/config.json', { timeoutMs: 8_000 });
    const url = String(cfg?.base_url || '').replace(/\/$/, '');
    if (/^https:\/\/[a-z0-9.-]+\.tst\.jus\.br$/i.test(url)) {
      baseTst = { url, em: Date.now() };
      return url;
    }
  } catch {
    /* usa o endereço conhecido */
  }
  return 'https://jurisprudencia-backend.tst.jus.br';
}

export async function tst(q: string, inicio = 1, tamanho = 10) {
  const base = await enderecoTst();
  const dados = await buscarJson(`${base}/rest/pesquisa-textual/${inicio}/${tamanho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Formato exato do site do TST. "orgao" e "numeracaoUnica.orgao" são obrigatórios; sem eles o filtro é ignorado.
    body: JSON.stringify({
      ou: null,
      e: termo(q),
      termoExato: '',
      naoContem: null,
      ementa: null,
      dispositivo: null,
      numeracaoUnica: { numero: null, digito: null, ano: null, orgao: '5', tribunal: null, vara: null },
      orgaosJudicantes: [],
      ministros: [],
      convocados: [],
      classesProcessuais: [],
      indicadores: [],
      assuntos: [],
      tipos: ['ACORDAO'],
      orgao: 'TST',
    }),
    timeoutMs: 40_000,
  });
  const itens: any[] = dados?.registros || [];
  return {
    total: Number(dados?.totalRegistros ?? itens.length),
    itens: itens.map((r: any) => {
      const x = r?.registro || r || {};
      return {
        numero: x.numFormatado || x.numeroFormatado || x.numero || '',
        orgao: x.orgaoJudicante?.descricao || x.orgaoJudicante || '',
        relator: nomeProprio(String(x.nomRelatorSemTratamento || x.nomRelator || x.relator?.nome || '').toUpperCase()),
        data: x.dtaJulgamento || x.dataJulgamento || '',
        ementa: String(x.ementa || x.txtEmenta || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 1200),
      };
    }),
  };
}

export async function tcu(q: string, quantidade = 10, inicio = 0) {
  const base = env('TCU_BASE') || 'https://pesquisa.apps.tcu.gov.br/rest/publico/base';
  const p = new URLSearchParams({ termo: termo(q), ordenacao: 'DTRELEVANCIA desc, NUMACORDAOINT desc', quantidade: String(quantidade), inicio: String(inicio) });
  const dados = await buscarJson(`${base}/acordao-completo/documentosResumidos?${p}`);
  const docs: any[] = dados?.documentos || dados?.docs || [];
  return {
    total: dados?.quantidadeEncontrada ?? docs.length,
    itens: docs.map((d: any) => ({
      titulo: d.TITULO || d.titulo || `Acórdão ${d.NUMACORDAO}/${d.ANOACORDAO}`,
      colegiado: d.COLEGIADO,
      relator: d.RELATOR,
      data: d.DATASESSAO,
      sumario: String(d.SUMARIO || d.sumario || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 1200),
    })),
  };
}

export async function carf(processo: string) {
  const num = (processo || '').replace(/[^\d./-]/g, '');
  if (num.length < 8) throw new ErroApi(400, 'Informe o número do processo administrativo.');
  const base = env('CARF_BASE') || 'https://acordaos.economia.gov.br';
  const p = new URLSearchParams({ q: `numero_processo_s:"${num}"`, wt: 'json', rows: '20' });
  const dados = await buscarJson(`${base}/solr/acordaos2/select?${p}`, { timeoutMs: 20_000 });
  return { total: dados?.response?.numFound ?? 0, itens: dados?.response?.docs || [] };
}

export async function camara(q: string) {
  const p = new URLSearchParams({ keywords: termo(q), ordem: 'DESC', ordenarPor: 'id', itens: '15' });
  const dados = await buscarJson(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?${p}`);
  return {
    itens: (dados?.dados || []).map((x: any) => ({
      id: x.id,
      sigla: `${x.siglaTipo} ${x.numero}/${x.ano}`,
      ementa: x.ementa,
      link: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${x.id}`,
    })),
  };
}

export async function stj(q: string) {
  const p = new URLSearchParams({ q: termo(q), rows: '15' });
  const dados = await buscarJson(`https://dadosabertos.web.stj.jus.br/api/3/action/package_search?${p}`);
  return {
    total: dados?.result?.count ?? 0,
    itens: (dados?.result?.results || []).map((x: any) => ({
      nome: x.title || x.name,
      descricao: String(x.notes || '').slice(0, 400),
      link: `https://dadosabertos.web.stj.jus.br/dataset/${x.name}`,
      recursos: (x.resources || []).length,
    })),
  };
}
