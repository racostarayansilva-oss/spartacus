// Agenda do monitor (horário de Belém). Liga sozinho no servidor próprio quando há SUPABASE_SECRET_KEY;
// MONITOR_ATIVO=0 desliga.
import { env } from '../http.js';
import { bancoMonitorConfigurado } from './banco.js';
import { executar, hojeBrasil, Rotina } from './rotinas.js';

const AGENDA: Record<Rotina, number[]> = {
  djen: [7, 13],
  datajud: [6, 12, 18],
};

export const monitorLigado = () => bancoMonitorConfigurado() && env('MONITOR_ATIVO') !== '0';

const feitas = new Set<string>();

function horaBrasil(): number {
  return Number(new Date().toLocaleString('en-US', { timeZone: 'America/Belem', hour: '2-digit', hour12: false })) % 24;
}

function verificar() {
  const hora = horaBrasil();
  const dia = hojeBrasil();
  for (const [rotina, horas] of Object.entries(AGENDA) as [Rotina, number[]][]) {
    const chave = `${rotina}:${dia}:${hora}`;
    if (!horas.includes(hora) || feitas.has(chave)) continue;
    feitas.add(chave);
    void executar(rotina, 'agenda');
  }
  if (feitas.size > 200) feitas.clear();
}

export function iniciarMonitor() {
  if (!monitorLigado()) {
    console.log('[monitor] desligado (falta SUPABASE_SECRET_KEY ou MONITOR_ATIVO=0)');
    return;
  }
  console.log('[monitor] ligado: DJEN às 7h e 13h; DataJud às 6h, 12h e 18h (horário de Belém)');
  setInterval(verificar, 60_000).unref();
}

export const AGENDA_TEXTO = 'DJEN às 7h e 13h; DataJud às 6h, 12h e 18h';
