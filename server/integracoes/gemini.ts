// Gemini (Google) para o Resumo Inteligente do processo.
// Chave em GEMINI_API_KEY (Vercel → Settings → Environment Variables; local: arquivo .env). Nunca no código.
// Chaves "AIza…" usam a API do Gemini (AI Studio); chaves "AQ.…" usam o Vertex AI em modo express.

import { ErroApi, env } from '../http.js';

export function geminiConfigurado(): boolean {
  return !!env('GEMINI_API_KEY');
}

function endereco(modelo: string, chave: string): string {
  if (chave.startsWith('AQ.')) return `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`;
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`;
}

/** Pede ao Gemini uma resposta em JSON no formato do esquema. */
export async function gerarJson<T>(instrucoes: string, conteudo: string, esquema: object): Promise<{ dados: T; modelo: string }> {
  const chave = env('GEMINI_API_KEY');
  if (!chave) throw new ErroApi(503, 'Resumo por IA desligado: cadastre GEMINI_API_KEY nas variáveis da Vercel.');
  const modelo = env('GEMINI_MODELO') || 'gemini-2.5-flash';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  let r: Response;
  try {
    r = await fetch(endereco(modelo, chave), {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucoes }] },
        contents: [{ role: 'user', parts: [{ text: conteudo }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: esquema },
      }),
    });
  } catch (e: any) {
    throw new ErroApi(504, e?.name === 'AbortError' ? 'O Gemini demorou mais de 45 s para responder. Tente de novo.' : `Não foi possível falar com o Gemini: ${e?.message || e}`);
  } finally {
    clearTimeout(t);
  }
  const corpo: any = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = String(corpo?.error?.message || corpo?.[0]?.error?.message || `HTTP ${r.status}`);
    if (r.status === 401 || r.status === 403 || /api key/i.test(msg)) throw new ErroApi(502, 'O Google recusou a chave do Gemini (GEMINI_API_KEY). Gere uma chave nova no Google AI Studio e atualize na Vercel.');
    if (r.status === 429) throw new ErroApi(429, 'Limite de uso do Gemini atingido. Aguarde um minuto e tente de novo.');
    throw new ErroApi(502, `Gemini respondeu ${r.status}: ${msg.slice(0, 200)}`);
  }
  const texto = corpo?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  try {
    return { dados: JSON.parse(texto) as T, modelo: String(corpo?.modelVersion || modelo) };
  } catch {
    throw new ErroApi(502, 'O Gemini não devolveu um resumo válido. Tente “Regenerar”.');
  }
}

const INSTRUCOES_RESUMO = `Você é assistente jurídico de um escritório de advocacia brasileiro (previdenciário, cível e trabalhista).
Receberá os dados de UM processo em JSON. Escreva em português do Brasil, tom objetivo, como uma ficha para o advogado.

"resumo": 2 a 4 frases, no estilo:
"Este é um processo de **ASSUNTOS OU CLASSE** com número **NÚMERO**. O valor da causa é de **R$ X**. O processo está em fase de **FASE** e tramita em **ÓRGÃO** desde DD/MM/AAAA."
Depois, se as movimentações mostrarem algo relevante (sentença, perícia ou audiência marcada, recurso, RPV), acrescente uma frase curta.
Regras: use só os dados recebidos, nunca invente; omita o que não vier (ex.: sem valor, não fale de valor); use **negrito** só em assuntos/classe, número, valor, fase e órgão; não cite nomes de pessoas.

"pontos": mantenha TODOS os itens de "pontosDeAtencao" (pode encurtar a redação) e acrescente no máximo 2 observações tiradas das movimentações que exijam ação. Frases curtas. Lista vazia se não houver nada.`;

const ESQUEMA_RESUMO = {
  type: 'OBJECT',
  properties: {
    resumo: { type: 'STRING' },
    pontos: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['resumo', 'pontos'],
};

/** Resumo de um processo (os dados chegam do app já sem nomes, CPF ou telefone). */
export async function resumirProcesso(dados: unknown) {
  if (!dados || typeof dados !== 'object') throw new ErroApi(400, 'Dados do processo ausentes.');
  const json = JSON.stringify(dados);
  if (json.length > 20_000) throw new ErroApi(400, 'Dados do processo grandes demais para o resumo.');
  const { dados: r, modelo } = await gerarJson<{ resumo: string; pontos: string[] }>(INSTRUCOES_RESUMO, json, ESQUEMA_RESUMO);
  return {
    texto: String(r.resumo || '').trim(),
    pontos: (Array.isArray(r.pontos) ? r.pontos : []).map((p) => String(p).trim()).filter(Boolean).slice(0, 8),
    modelo,
  };
}
