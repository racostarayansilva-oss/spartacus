// E-mail gerado para o cliente: o escritório cadastra esse endereço no gov.br / Meu INSS
// e os códigos e avisos chegam dentro do app, em "E-mails dos clientes".
import { normalizar } from './importacao';

const PREPOSICOES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** Limpa o domínio digitado (tira @, http://, espaços e barra final). Devolve '' se não parecer um domínio. */
export function limparDominio(texto: string): string {
  const d = texto.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/.*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
}

/** Parte antes do @: primeiro e último nome, sem acento, mais 4 caracteres aleatórios (ninguém adivinha o endereço). */
export function parteLocal(nome: string, sufixo: string): string {
  const partes = normalizar(nome).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((p) => p && !PREPOSICOES.has(p));
  const base = (partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes).join('.').slice(0, 40) || 'cliente';
  return `${base}.${sufixo}`;
}

export function sufixoAleatorio(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  const n = new Uint32Array(4);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => letras[x % letras.length]).join('');
}

/** Gera um endereço que ainda não está em uso por outro cliente. */
export function gerarEmailCliente(nome: string, dominio: string, emUso: Set<string>, sorteio = sufixoAleatorio): string {
  for (let i = 0; i < 20; i++) {
    const e = `${parteLocal(nome, sorteio())}@${dominio}`;
    if (!emUso.has(e)) return e;
  }
  throw new Error('Não foi possível gerar um endereço livre. Tente de novo.');
}

/** Código do Email Worker do Cloudflare, já com o endereço do app e a chave. */
export function codigoWorker(urlApi: string, chave: string): string {
  return `// Spartacus: entrega os e-mails dos clientes ao app.
export default {
  async email(message) {
    const bytes = new Uint8Array(await new Response(message.raw).arrayBuffer()).subarray(0, 3000000);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const r = await fetch(${JSON.stringify(urlApi)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: ${JSON.stringify(chave)}, para: message.to, de: message.from, raw: btoa(bin) }),
    });
    if (!r.ok) throw new Error('Spartacus respondeu ' + r.status + ': ' + (await r.text()));
  },
};
`;
}

/** HTML do e-mail para mostrar num iframe isolado (sem scripts); links abrem em outra aba. */
export function htmlSeguro(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"><style>body{font-family:system-ui,sans-serif;font-size:14px;color:#1d1d24;background:#fff;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}
