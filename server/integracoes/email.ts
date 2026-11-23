// Recepção dos e-mails dos clientes. O Cloudflare Email Routing entrega cada mensagem ao Email Worker,
// que manda o e-mail bruto (base64) para POST /api/email/entrada. Aqui o e-mail é lido e gravado no banco
// pela função receber_email do Supabase, que confere a chave e liga o e-mail ao cliente dono do endereço.
import PostalMime from 'postal-mime';
import { ErroApi } from '../http.js';
import { supabaseConfigurado } from '../auth.js';

export interface EmailLido {
  de: string; assunto: string; texto: string; html: string;
  anexos: { nome: string; tipo: string; tamanho: number }[];
  recebidoEm: string;
}

const endereco = (a?: { name?: string; address?: string } | null) =>
  !a ? '' : a.name && a.address ? `${a.name} <${a.address}>` : a.address || a.name || '';

/** Lê o e-mail bruto (RFC 822). Os anexos não são guardados, só nome, tipo e tamanho. */
export async function lerEmail(bruto: Uint8Array | string, deEnvelope = ''): Promise<EmailLido> {
  const m = await PostalMime.parse(bruto);
  const data = m.date ? new Date(m.date) : new Date();
  return {
    de: endereco(m.from as any) || deEnvelope,
    assunto: (m.subject || '(sem assunto)').trim(),
    texto: m.text || '',
    html: m.html || '',
    anexos: (m.attachments || []).map((a) => ({
      nome: a.filename || 'anexo',
      tipo: a.mimeType || '',
      tamanho: typeof a.content === 'string' ? a.content.length : (a.content as ArrayBuffer)?.byteLength ?? 0,
    })),
    recebidoEm: (isNaN(data.getTime()) ? new Date() : data).toISOString(),
  };
}

export async function receberEmail(corpo: any): Promise<{ id: string }> {
  const chave = String(corpo?.chave || '');
  const para = String(corpo?.para || '').trim().toLowerCase();
  const raw = String(corpo?.raw || '');
  if (!chave || !para || !raw) throw new ErroApi(400, 'Envie chave, para e raw (e-mail em base64).');
  const cfg = supabaseConfigurado();
  if (!cfg) throw new ErroApi(503, 'Supabase não configurado: não há onde guardar o e-mail.');

  const email = await lerEmail(Buffer.from(raw, 'base64'), String(corpo?.de || ''));
  const r = await fetch(`${cfg.url}/rest/v1/rpc/receber_email`, {
    method: 'POST',
    headers: { apikey: cfg.chave, Authorization: `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_chave: chave, p_para: para, p_de: email.de, p_assunto: email.assunto,
      p_texto: email.texto, p_html: email.html, p_anexos: email.anexos, p_recebido_em: email.recebidoEm,
    }),
  });
  const texto = await r.text();
  if (!r.ok) {
    if (/Chave inválida/.test(texto)) throw new ErroApi(401, 'Chave de e-mails inválida. Gere outra em Configurações e atualize o Worker.');
    throw new ErroApi(502, `Banco respondeu ${r.status}`, texto.slice(0, 300));
  }
  return { id: JSON.parse(texto) };
}
