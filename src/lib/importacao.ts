// Importação de processos pela OAB, a partir das comunicações do DJEN (CNJ) — como o Legis faz.
// Cada comunicação traz o número do processo, a classe, o órgão e as partes intimadas (polo A/P).
// Agrupamos por número, identificamos cliente (polo ativo) e parte contrária (polo passivo) e
// criamos os processos e clientes que ainda não existem.

import type { Banco, Cliente, Processo } from '../store.js';
import { parseCnj } from './cnj.js';
import { somenteDigitos } from './cpf.js';
import { DataISO } from './datas.js';
import { TipoProcesso } from './etapas.js';

export interface ComunicacaoDjen {
  id: string;
  disponibilizacao: string;
  tribunal: string;
  processo: string;
  orgao?: string;
  tipo?: string;
  classe?: string;
  texto: string;
  partes: { nome: string; polo: string }[];
  advogados: { nome: string; oab: string }[];
}

export interface ProcessoEncontrado {
  digitos: string;
  numero: string;
  tribunal: string;
  orgao: string;
  classe: string;
  cliente: string;
  parteContraria: string;
  /** Lado do cliente no processo (A = autor, P = réu) */
  poloCliente?: 'A' | 'P';
  primeira: DataISO;
  ultima: DataISO;
  comunicacoes: ComunicacaoDjen[];
}

export const normalizar = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);
const SIGLAS = ['SA', 'INSS', 'SJPA', 'SJMA', 'JEF', 'TRF1', 'TJMA', 'TJPA', 'TRT', 'S/A', 'S.A.', 'LTDA', 'ME', 'EPP', 'CEF'];

/** "MARIA DAS GRAÇAS SOUZA" → "Maria das Graças Souza" (só quando o texto vem todo em maiúsculas). */
export function nomeProprio(s: string): string {
  const t = (s || '').trim().replace(/\s+/g, ' ');
  // "Quase tudo em maiúsculas" (o DJEN às vezes grava "CíVEL")
  const letras = t.replace(/[^\p{L}]/gu, '');
  const maiusculas = letras.replace(/[^\p{Lu}]/gu, '').length;
  if (!t || !letras.length || maiusculas / letras.length < 0.6) return t;
  return t
    .toLowerCase()
    .split(' ')
    .map((p, i) => {
      if (SIGLAS.includes(p.toUpperCase())) return p.toUpperCase();
      if (/^\d+[ªº]?$/.test(p)) return p;
      return i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

// Onde termina o nome de uma parte no texto corrido da intimação
const FIM_DO_NOME = /\s+(?:REPRESENTANTES?|POLO (?:ATIVO|PASSIVO)|ADVOGAD[OA]S?|Destinat[áa]rios?|INTIMA[ÇC][ÃA]O|DESPACHO|DECIS[ÃA]O|SENTEN[ÇC]A|ATO ORDINAT[ÓO]RIO|CERTID[ÃA]O|Considerando|Vistos|Trata-se|Cuida-se|Fica(?:m)?\s|Intime|De ordem|Certifico|PROCESSO\s*(?:N|:)|CLASSE\s*:|Ju[ií]z(?:a|o)?\s|Relator|ASSUNTOs*:|PERITO|CUSTOS LEGIS|REGISTRAD[OA](?:\(A\))? CIVILMENTE)/i;

/** Corta o texto que vem grudado depois do nome da parte (despacho, decisão etc.) e limita o tamanho. */
export function limparNomeParte(s: string, max = 100): string {
  let t = (s || '').replace(/\s+/g, ' ').trim();
  // Nome de parte não tem dois-pontos: "FINALIDADE:", "PRAZO:", "DESTINATÁRIO(S):" marcam o fim.
  const cortes = [t.match(FIM_DO_NOME), t.match(/\s[\p{Lu}()]{3,}\s*:/u)]
    .map((m) => m?.index)
    .filter((i): i is number => i !== undefined && i > 2);
  if (cortes.length) t = t.slice(0, Math.min(...cortes));
  t = t.replace(/\s*[-–]\s*CPF.*$/i, '').replace(/\s*\(\s*\d[\d./-]*\s*\)\s*$/, '').replace(/[\s,;:.–-]+$/, '').trim();
  if (t.length > max) {
    const corte = t.slice(0, max);
    t = corte.slice(0, Math.max(corte.lastIndexOf(' '), max * 0.6)).trim();
  }
  return t;
}

/** Polo ativo/passivo pelo texto da intimação, quando a lista de partes não vem preenchida. */
export function poloPeloTexto(texto: string, polo: 'ATIVO' | 'PASSIVO'): string {
  const m = texto.match(new RegExp(`POLO ${polo}\\s*:\\s*(.+)`, 'i'));
  return m ? limparNomeParte(m[1]) : '';
}

export function tipoPeloNumero(numero: string): TipoProcesso {
  const c = parseCnj(numero);
  if (!c) return 'ADM_INSS';
  if (c.justica === '5') return 'TRABALHISTA';
  if (c.justica === '4') return 'JEF';
  return 'CIVEL';
}

/** Órgãos públicos e réus institucionais que nunca são o nosso cliente. */
const ENTE_PUBLICO = /instituto nacional do seguro social|\binss\b|uniao federal|fazenda (publica|nacional)|ministerio publico|caixa economica federal/;

const EMPRESA = /\b(s\.?\/?a\.?|ltda|eireli|me|epp|banco|bradesco|itau|santander|seguradora|seguros|cia|companhia|telecom|energia|bioenergia|equatorial|claro|vivo|tim|oi|cooperativa|associacao|sindicato|condominio|empresa|comercio|industria)\b/;

export const CLIENTE_A_IDENTIFICAR = 'Cliente a identificar';

/** Junta as comunicações por número de processo. */
export function agruparPorProcesso(comunicacoes: ComunicacaoDjen[]): ProcessoEncontrado[] {
  const mapa = new Map<string, ProcessoEncontrado>();
  for (const c of comunicacoes) {
    const digitos = somenteDigitos(c.processo);
    if (digitos.length < 15) continue;
    let p = mapa.get(digitos);
    if (!p) {
      p = {
        digitos, numero: parseCnj(digitos)?.formatado ?? c.processo, tribunal: c.tribunal, orgao: c.orgao || '', classe: c.classe || '',
        cliente: '', parteContraria: '', primeira: c.disponibilizacao, ultima: c.disponibilizacao, comunicacoes: [],
      };
      mapa.set(digitos, p);
    }
    if (p.comunicacoes.some((x) => x.id === c.id)) continue;
    p.comunicacoes.push(c);
    if (c.disponibilizacao < p.primeira) p.primeira = c.disponibilizacao;
    if (c.disponibilizacao >= p.ultima) {
      p.ultima = c.disponibilizacao;
      // Órgão e classe mais recentes (o processo pode ter subido de instância)
      if (c.orgao) p.orgao = c.orgao;
      if (c.classe) p.classe = c.classe;
      if (c.tribunal) p.tribunal = c.tribunal;
    }
    // Os destinatários da comunicação são as partes representadas pelo advogado intimado,
    // ou seja, em regra o nosso cliente. Prefere o polo ativo; se só houver polo passivo, é ele.
    const advogados = new Set(c.advogados.map((a) => normalizar(a.nome)));
    // Quando a lista traz as duas partes, a pessoa física é quase sempre o cliente do escritório.
    const todos = c.partes.filter((x) => !advogados.has(normalizar(x.nome)) && !ENTE_PUBLICO.test(normalizar(x.nome)));
    const pessoas = todos.filter((x) => !EMPRESA.test(normalizar(x.nome)));
    const candidatos = pessoas.length ? pessoas : todos;
    const ativo = candidatos.find((x) => x.polo === 'A')?.nome || '';
    const passivo = candidatos.find((x) => x.polo === 'P')?.nome || '';
    if (!p.cliente) {
      p.cliente = limparNomeParte(ativo || passivo) || poloPeloTexto(c.texto, 'ATIVO');
      if (p.cliente) p.poloCliente = ativo || !passivo ? 'A' : 'P';
    }
    if (!p.parteContraria) {
      const outro = p.poloCliente === 'P' ? 'A' : 'P';
      const contra = poloPeloTexto(c.texto, outro === 'A' ? 'ATIVO' : 'PASSIVO')
        || c.partes.find((x) => x.polo === outro && !advogados.has(normalizar(x.nome)))?.nome || '';
      if (contra && normalizar(contra) !== normalizar(p.cliente)) p.parteContraria = limparNomeParte(contra);
    }
  }
  return [...mapa.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
}

export const MARCA_IMPORTADO = 'Importado pela OAB';

/** Processos que vieram da importação pela OAB (marcados na etapa de entrada). */
export function processosImportados(banco: Banco): Processo[] {
  return banco.processos.filter((p) => p.etapas.some((e) => (e.obs || '').startsWith(MARCA_IMPORTADO)));
}

/**
 * Registro retroativo para a importação feita antes de existir a aba Importações.
 * Usa a conta que fez a importação (gravada como responsável nos processos importados).
 */
export function registroRetroativo(banco: Banco, novoId: () => string, nomeConta: string, agora: string) {
  if ((banco.config.importacoes || []).length) return null;
  const importados = processosImportados(banco);
  if (!importados.length) return null;
  const contagem = new Map<string, number>();
  for (const p of importados) contagem.set(p.responsavelId, (contagem.get(p.responsavelId) || 0) + 1);
  const usuarioId = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const clientes = new Set(importados.map((p) => p.clienteId));
  const datas = importados.map((p) => p.etapas[0]?.data).filter(Boolean).sort();
  return {
    id: novoId(),
    em: agora,
    usuarioId,
    usuarioNome: nomeConta,
    fonte: 'OAB (DJEN/CNJ)',
    oabs: banco.config.oabs.map((o) => `OAB/${o.uf} ${o.numero}`),
    periodo: datas.length ? { inicio: datas[0], fim: datas[datas.length - 1] } : undefined,
    processosNovos: importados.length,
    clientesNovos: banco.clientes.filter((c) => clientes.has(c.id) && (c.obs || '').startsWith('Importado pela OAB')).length,
    jaExistentes: 0,
    observacao: 'Registro criado a partir dos processos já importados antes da aba Importações.',
  };
}

export interface ResultadoImportacao {
  processos: Processo[];
  clientesNovos: Cliente[];
  jaExistentes: number;
  semCliente: ProcessoEncontrado[];
}

/** Cria processos e clientes novos. Processos já cadastrados (mesmo número) são pulados. */
export function montarImportacao(
  encontrados: ProcessoEncontrado[],
  banco: Banco,
  novoId: () => string,
  responsavelId: string,
  maxMovimentos = 20,
  /** true = importa também os processos sem parte identificada, ligados a "Cliente a identificar" */
  incluirSemCliente = false,
): ResultadoImportacao {
  const existentes = new Set(banco.processos.map((p) => somenteDigitos(p.numero)));
  const clientesPorNome = new Map(banco.clientes.map((c) => [normalizar(c.nome), c]));
  const r: ResultadoImportacao = { processos: [], clientesNovos: [], jaExistentes: 0, semCliente: [] };

  for (const e of encontrados) {
    if (existentes.has(e.digitos)) { r.jaExistentes++; continue; }
    if (!e.cliente) {
      r.semCliente.push(e);
      if (!incluirSemCliente) continue;
    }
    existentes.add(e.digitos);

    const nome = e.cliente ? nomeProprio(e.cliente) : CLIENTE_A_IDENTIFICAR;
    let cliente = clientesPorNome.get(normalizar(nome));
    if (!cliente) {
      cliente = {
        id: novoId(), nome, cpf: '', telefone: '', origem: 'nao_informada', corretorId: null,
        responsavelId, criadoEm: e.primeira, obs: 'Importado pela OAB (DJEN)',
      };
      clientesPorNome.set(normalizar(nome), cliente);
      r.clientesNovos.push(cliente);
    }

    const contra = nomeProprio(e.parteContraria);
    const movimentos = [...e.comunicacoes]
      .sort((a, b) => b.disponibilizacao.localeCompare(a.disponibilizacao))
      .slice(0, maxMovimentos)
      .map((c) => ({
        data: c.disponibilizacao,
        nome: `${c.tipo || 'Comunicação'} no DJEN — ${c.tribunal}`,
        complemento: c.texto.slice(0, 400),
      }));

    r.processos.push({
      id: novoId(),
      numero: e.numero,
      tipo: tipoPeloNumero(e.numero),
      clienteId: cliente.id,
      assunto: [nomeProprio(e.classe), contra && `contra ${contra}`].filter(Boolean).join(' — '),
      responsavelId,
      valor: 0,
      corretorId: null,
      regiao: nomeProprio(e.orgao),
      etapas: [{ etapa: 'Entrada', data: e.primeira, obs: `Importado pela OAB — 1ª comunicação no DJEN em ${e.primeira.split('-').reverse().join('/')}` }],
      grupoFamiliar: [],
      movimentosOficiais: movimentos,
    });
  }
  return r;
}
