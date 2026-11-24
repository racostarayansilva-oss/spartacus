// CRM (Evo CRM Community) dentro do Spartacus, já logado: a ponte troca a sessão por um token do CRM
// e o entrega à página sso.html do CRM por postMessage (o token nunca vai na URL).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Topo } from '../components/ui';

interface SessaoCrm { url: string; token: string; expiraEm: number }

export default function Crm() {
  const [sessao, setSessao] = useState<SessaoCrm | null>(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const sessaoRef = useRef<SessaoCrm | null>(null);

  useEffect(() => {
    let vivo = true;
    setErro('');
    api<SessaoCrm>('crm/sessao', { method: 'POST' })
      .then((s) => { if (vivo) { sessaoRef.current = s; setSessao(s); } })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [versao]);

  // Renova a ponte 5 minutos antes de o token do CRM expirar.
  useEffect(() => {
    if (!sessao) return;
    const t = setTimeout(() => setVersao((v) => v + 1), Math.max(60_000, sessao.expiraEm - Date.now() - 300_000));
    return () => clearTimeout(t);
  }, [sessao]);

  useEffect(() => {
    const aoMensagem = (e: MessageEvent) => {
      const s = sessaoRef.current;
      if (!s || e.origin !== new URL(s.url).origin || !e.data?.crmPronto) return;
      (e.source as Window | null)?.postMessage({ token: s.token, caminho: '/' }, e.origin);
    };
    window.addEventListener('message', aoMensagem);
    return () => window.removeEventListener('message', aoMensagem);
  }, []);

  return (
    <>
      <Topo titulo="CRM" subtitulo="Atendimento e contatos">
        {sessao && <button className="btn" onClick={() => window.open(`${sessao.url}/sso.html`, '_blank')}>Abrir em nova aba</button>}
      </Topo>
      {erro && (
        <div className="erro">
          {erro} <button className="btn pequeno" onClick={() => setVersao((v) => v + 1)}>Tentar de novo</button>
        </div>
      )}
      {!erro && !sessao && <p className="mudo">Conectando ao CRM…</p>}
      {sessao && (
        <iframe
          key={sessao.token}
          src={`${sessao.url}/sso.html`}
          title="CRM"
          allow="microphone; clipboard-read; clipboard-write"
          style={{ width: '100%', height: 'calc(100vh - 140px)', border: '1px solid var(--borda)', borderRadius: 'var(--raio-lg)', background: 'var(--superficie)' }}
        />
      )}
    </>
  );
}
