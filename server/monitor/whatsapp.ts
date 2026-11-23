// Envio de resumo pelo WhatsApp do escritório (Evolution API na mesma VPS).
// EVOLUTION_URL (padrão http://evolution-api:8080), EVOLUTION_API_KEY, EVOLUTION_INSTANCIA (opcional: senão usa a conectada)
// e MONITOR_WHATSAPP_DESTINO: número com DDI e DDD (5591999999999) ou id do grupo (…@g.us).
import { env } from '../http.js';

const base = () => (env('EVOLUTION_URL') || 'http://evolution-api:8080').replace(/\/$/, '');

export const whatsappConfigurado = () => !!(env('EVOLUTION_API_KEY') && env('MONITOR_WHATSAPP_DESTINO'));

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

async function instancia(): Promise<string> {
  if (env('EVOLUTION_INSTANCIA')) return env('EVOLUTION_INSTANCIA');
  const lista: any[] = (await chamar('/instance/fetchInstances')) || [];
  const conectada = lista.find((i) => (i.connectionStatus || i.instance?.state) === 'open') || lista[0];
  const nome = conectada?.name || conectada?.instance?.instanceName;
  if (!nome) throw new Error('Nenhum WhatsApp conectado na Evolution API.');
  return nome;
}

export async function enviarWhatsapp(texto: string) {
  if (!whatsappConfigurado()) return false;
  await chamar(`/message/sendText/${encodeURIComponent(await instancia())}`, {
    method: 'POST',
    body: JSON.stringify({ number: env('MONITOR_WHATSAPP_DESTINO'), text: texto.slice(0, 4000) }),
  });
  return true;
}
