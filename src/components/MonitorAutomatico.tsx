// Situação do monitor automático (DJEN + DataJud) que roda no servidor próprio.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useBanco, usuarioAtual } from '../store';

type Rotina = 'djen' | 'datajud';
interface Execucao { situacao: 'rodando' | 'ok' | 'erro'; inicio: string; fim?: string; origem: string; erro?: string; resumo?: Record<string, any> }
interface Estado { ligado: boolean; agenda: string; whatsapp: boolean; estado: Partial<Record<Rotina, Execucao>> }

const NOME: Record<Rotina, string> = { djen: 'Intimações (DJEN)', datajud: 'Andamentos (DataJud)' };
const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function resumo(r: Rotina, e: Execucao): string {
  if (e.situacao === 'rodando') return `Rodando desde ${quando(e.inicio)}…`;
  if (e.situacao === 'erro') return `Falhou em ${quando(e.fim)}: ${e.erro}`;
  const s = e.resumo || {};
  if (s.aviso) return String(s.aviso);
  const partes = r === 'djen'
    ? [`${s.intimacoesNovas ?? 0} intimação(ões) nova(s)`, s.processosNovos ? `${s.processosNovos} processo(s) cadastrado(s)` : '']
    : [`${s.comAndamentoNovo ?? 0} com andamento novo`, `${s.encontrados ?? 0} de ${s.consultados ?? 0} encontrados no DataJud`, s.falhas ? `${s.falhas} sem resposta do CNJ` : ''];
  const zap = s.whatsapp ? ' · resumo enviado no WhatsApp' : s.erroWhatsapp ? ' · WhatsApp falhou' : '';
  return `${quando(e.fim)} · ${partes.filter(Boolean).join(' · ')}${zap}`;
}

export function MonitorAutomatico() {
  const b = useBanco();
  const admin = usuarioAtual(b)?.papel === 'advogado';
  const [estado, setEstado] = useState<Estado | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = () => api<Estado>('monitor/estado').then(setEstado).catch(() => setEstado(null));
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => clearInterval(t);
  }, []);

  // Na Vercel (sem servidor próprio) a rota não existe: o quadro não aparece.
  if (!estado) return null;

  const rodar = async (r: Rotina) => {
    setMsg('');
    try {
      const x = await api<{ iniciado: boolean; mensagem?: string }>('monitor/executar', { method: 'POST', body: JSON.stringify({ rotina: r }) });
      setMsg(x.iniciado ? `${NOME[r]}: começou. Pode levar alguns minutos; os avisos chegam no sino.` : x.mensagem || '');
      setTimeout(carregar, 1500);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <div className="cartao" style={{ marginBottom: 12 }}>
      <div className="cartao-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>Monitor automático</h3>
          <div className="mudo">
            {estado.ligado ? `Roda sozinho: ${estado.agenda} (horário de Belém).` : 'Desligado: falta configurar a chave do servidor.'}
            {estado.ligado && (estado.whatsapp ? ' Resumo também no WhatsApp da equipe.' : ' Avisos só no sino (WhatsApp não configurado).')}
          </div>
        </div>
      </div>
      {estado.ligado && (
        <div className="grade" style={{ gap: 8, marginTop: 8 }}>
          {(['djen', 'datajud'] as Rotina[]).map((r) => {
            const e = estado.estado[r];
            return (
              <div key={r} className="flex" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <b>{NOME[r]}</b>
                  <div className={e?.situacao === 'erro' ? 'erro' : 'mudo'} style={{ fontSize: 13 }}>{e ? resumo(r, e) : 'Ainda não rodou.'}</div>
                </div>
                {admin && <button className="btn pequeno" onClick={() => rodar(r)} disabled={e?.situacao === 'rodando'}>{e?.situacao === 'rodando' ? 'Rodando…' : 'Rodar agora'}</button>}
              </div>
            );
          })}
          {msg && <div className="aviso">{msg}</div>}
        </div>
      )}
    </div>
  );
}
