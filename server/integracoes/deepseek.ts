// DeepSeek (China) para o Resumo Inteligente. Compatível com OpenAI, muito mais barato.
// Chave em DEEPSEEK_API_KEY (Vercel → Settings → Environment Variables; local: arquivo .env).

import { ErroApi, env } from '../http.js';

export function deepseekConfigurado(): boolean {
  return !!env('DEEPSEEK_API_KEY');
}

/** Pede ao DeepSeek uma resposta em JSON. */
export async function gerarJson<T>(instrucoes: string, conteudo: string): Promise<{ dados: T; modelo: string }> {
  const chave = env('DEEPSEEK_API_KEY');
  if (!chave) throw new ErroApi(503, 'Resumo por IA desligado: cadastre DEEPSEEK_API_KEY nas variáveis da Vercel.');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  let r: Response;
  try {
    r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        messages: [
          { role: 'system', content: instrucoes },
          { role: 'user', content: conteudo },
        ],
      }),
    });
  } catch (e: any) {
    throw new ErroApi(504, e?.name === 'AbortError' ? 'DeepSeek demorou mais de 45 s. Tente de novo.' : `Não consegui falar com DeepSeek: ${e?.message || e}`);
  } finally {
    clearTimeout(t);
  }

  const corpo: any = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = String(corpo?.error?.message || `HTTP ${r.status}`);
    if (r.status === 401 || /invalid_api_key|unauthorized/i.test(msg)) throw new ErroApi(502, 'Chave do DeepSeek inválida (DEEPSEEK_API_KEY). Gere uma nova em https://platform.deepseek.com e atualize na Vercel.');
    if (r.status === 429) throw new ErroApi(429, 'Limite de requisições do DeepSeek atingido. Aguarde um minuto e tente de novo.');
    if (/insufficient.*balance|no.*credit/i.test(msg)) throw new ErroApi(402, `DeepSeek: sem créditos. Recarregue em https://platform.deepseek.com - ${msg}`);
    throw new ErroApi(502, `DeepSeek respondeu ${r.status}: ${msg.slice(0, 200)}`);
  }

  const texto = corpo?.choices?.[0]?.message?.content || '';
  try {
    // DeepSeek às vezes retorna o JSON com markdown code blocks
    const json = texto.includes('```') ? texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1) : texto;
    return { dados: JSON.parse(json) as T, modelo: corpo?.model || 'deepseek-chat' };
  } catch {
    throw new ErroApi(502, 'DeepSeek não devolveu um resumo válido. Tente "Regenerar".');
  }
}

const INSTRUCOES = `Você é assistente jurídico de um escritório de advocacia brasileiro (previdenciário, cível e trabalhista).
Receberá os dados de UM processo em JSON. Escreva em português do Brasil, tom objetivo, como uma ficha para o advogado.

"resumo": 2 a 4 frases, no estilo:
"Este é um processo de **ASSUNTOS OU CLASSE** com número **NÚMERO**. O valor da causa é de **R$ X**. O processo está em fase de **FASE** e tramita em **ÓRGÃO** desde DD/MM/AAAA."
Se as movimentações mostrarem algo relevante (sentença, perícia, audiência marcada, recurso, RPV), acrescente uma frase curta.
Regras: use só os dados recebidos, nunca invente; omita o que não vier; use **negrito** só em assuntos/classe, número, valor, fase e órgão; não cite nomes de pessoas.

"pontos": mantenha TODOS os itens de "pontosDeAtencao" (pode encurtar) e acrescente no máximo 2 observações das movimentações. Frases curtas. Lista vazia se não houver nada.

Devolva um JSON válido: { "resumo": "...", "pontos": [...] }`;

const INSTRUCOES_FALA = `Você é assistente jurídico. Recebe uma transcrição de áudio em português do Brasil
(reunião com cliente, depoimento ou nota de voz) e deve devolver:
"resumo": 2 a 5 frases objetivas do que foi dito.
"pontos": lista curta com decisões, prazos, nomes e próximas ações mencionados (até 8 itens). Use o que a fala disser; não invente.
Resposta em JSON: { "resumo": "...", "pontos": [...] }`;

export async function resumirFala(texto: string) {
  const limpo = String(texto || '').trim();
  if (!limpo) throw new ErroApi(400, 'Grave algo antes de pedir o resumo.');
  if (limpo.length > 40_000) throw new ErroApi(400, 'A transcrição ficou grande demais (acima de 40 mil caracteres).');
  const { dados: r, modelo } = await gerarJson<{ resumo: string; pontos: string[] }>(INSTRUCOES_FALA, limpo);
  return {
    texto: String(r.resumo || '').trim(),
    pontos: (Array.isArray(r.pontos) ? r.pontos : []).map((p) => String(p).trim()).filter(Boolean).slice(0, 8),
    modelo,
  };
}

export async function resumirProcesso(dados: unknown) {
  if (!dados || typeof dados !== 'object') throw new ErroApi(400, 'Dados do processo ausentes.');
  const json = JSON.stringify(dados);
  if (json.length > 20_000) throw new ErroApi(400, 'Dados do processo grandes demais para o resumo.');
  const { dados: r, modelo } = await gerarJson<{ resumo: string; pontos: string[] }>(INSTRUCOES, json);
  return {
    texto: String(r.resumo || '').trim(),
    pontos: (Array.isArray(r.pontos) ? r.pontos : []).map((p) => String(p).trim()).filter(Boolean).slice(0, 8),
    modelo,
  };
}
