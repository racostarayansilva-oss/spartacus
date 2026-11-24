// Resumo do monitor pelo WhatsApp de cada escritório (Evolution API na mesma VPS).
// EVOLUTION_URL (padrão http://evolution-api:8080) e EVOLUTION_API_KEY ficam no servidor; a instância e o
// destino (número com DDI e DDD, ou id do grupo …@g.us) são de cada escritório (Plataforma → escritório).
// Sem destino cadastrado o escritório não recebe resumo: nunca manda dados de um escritório para outro número.
import { env } from '../http.js';

const base = () => (env('EVOLUTION_URL') || 'http://evolution-api:8080').replace(/\/$/, '');

export interface WhatsappEscritorio { instancia?: string; destino?: string }

export const whatsappConfigurado = (w?: WhatsappEscritorio) => !!(env('EVOLUTION_API_KEY') && w?.instancia && w?.destino);

async function chamar(caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${base()}${caminho}`, {
    ...init,
    headers: { apikey: env('EVOLUTION_API_KEY'), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

export async function enviarWhatsapp(texto: string, w?: WhatsappEscritorio) {
  if (!whatsappConfigurado(w)) return false;
  await chamar(`/message/sendText/${encodeURIComponent(w!.instancia!)}`, {
    method: 'POST',
    body: JSON.stringify({ number: w!.destino, text: texto.slice(0, 4000) }),
  });
  return true;
}
