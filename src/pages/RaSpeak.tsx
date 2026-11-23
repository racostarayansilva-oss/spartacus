// RA Speak: grava do microfone, transcreve com a API de voz do navegador (grátis) e, se a
// equipe pedir, manda o texto para o Resumo Inteligente (DeepSeek) resumir.
// Observação: a Web Speech API funciona no Chrome e no Edge. O Safari ainda não oferece.

import { useEffect, useRef, useState } from 'react';
import { Topo } from '../components/ui';
import { Icone } from '../components/icones';
import { api } from '../api';

// Tipos mínimos da Web Speech API (o TypeScript não traz por padrão)
type ReconhecedorEvento = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type ReconhecedorErro = { error: string };
interface Reconhecedor {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: ReconhecedorEvento) => void) | null;
  onerror: ((e: ReconhecedorErro) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}

function criarReconhecedor(): Reconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'pt-BR';
  return r;
}

export default function RaSpeak() {
  const [suportado, setSuportado] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [texto, setTexto] = useState('');
  const [resumo, setResumo] = useState<{ texto: string; pontos: string[]; modelo: string } | null>(null);
  const [erro, setErro] = useState('');
  const [resumindo, setResumindo] = useState(false);
  const reconRef = useRef<Reconhecedor | null>(null);

  useEffect(() => {
    const r = criarReconhecedor();
    if (!r) { setSuportado(false); return; }
    reconRef.current = r;
    r.onresult = (e) => {
      let acum = '';
      let incompleta = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) acum += t + ' '; else incompleta += t;
      }
      if (acum) setTexto((t) => (t + ' ' + acum).trim());
      setParcial(incompleta);
    };
    r.onerror = (e) => setErro(e.error === 'not-allowed' ? 'Você precisa liberar o microfone no navegador.' : `Erro: ${e.error}`);
    r.onend = () => { setGravando(false); setParcial(''); };
    return () => { try { r.stop(); } catch { /* ignora */ } };
  }, []);

  const alternar = () => {
    const r = reconRef.current;
    if (!r) return;
    if (gravando) { r.stop(); return; }
    setErro(''); setResumo(null);
    try { r.start(); setGravando(true); } catch (e: any) { setErro(e?.message || 'Não consegui iniciar a gravação.'); }
  };

  const limpar = () => { setTexto(''); setParcial(''); setResumo(null); setErro(''); };

  const resumir = async () => {
    if (!texto.trim()) return;
    setResumindo(true); setErro(''); setResumo(null);
    try {
      const r = await api<{ texto: string; pontos: string[]; modelo: string }>('ia/resumir-fala', { method: 'POST', body: JSON.stringify({ texto }) });
      setResumo(r);
    } catch (e: any) { setErro(e.message); } finally { setResumindo(false); }
  };

  const copiar = () => navigator.clipboard.writeText(texto).catch(() => { /* sem clipboard */ });

  if (!suportado) {
    return (
      <>
        <Topo titulo="RA Speak" subtitulo="Fale e eu transcrevo" />
        <div className="cartao">Este navegador não oferece a API de voz. Abra no <b>Chrome</b> ou no <b>Edge</b> (desktop ou Android) para usar o RA Speak.</div>
      </>
    );
  }

  return (
    <>
      <Topo titulo="RA Speak" subtitulo="Fale e eu transcrevo. Depois pode resumir.">
        <button className="btn" onClick={limpar} disabled={gravando}>Limpar</button>
        <button className="btn" onClick={copiar} disabled={!texto}>Copiar</button>
        <button className="btn" onClick={resumir} disabled={!texto || resumindo}>{resumindo ? 'Resumindo…' : 'Resumir com IA'}</button>
      </Topo>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button
          onClick={alternar}
          title={gravando ? 'Parar' : 'Falar'}
          style={{
            width: 72, height: 72, borderRadius: '50%', border: 0, cursor: 'pointer',
            background: gravando ? 'var(--perigo, #e03a3a)' : 'var(--primario)',
            color: 'var(--texto-no-primario, #111)',
            boxShadow: gravando ? '0 0 0 6px rgba(224,58,58,0.25)' : 'none',
            transition: 'box-shadow .2s',
          }}
        >
          <Icone nome="whatsapp" tamanho={28} />
        </button>
        <div>
          <div style={{ fontWeight: 600 }}>{gravando ? 'Ouvindo…' : 'Toque no microfone e comece a falar'}</div>
          <div className="mudo" style={{ fontSize: 12 }}>Idioma: português do Brasil</div>
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <textarea
        value={texto + (parcial ? ' ' + parcial : '')}
        onChange={(e) => { setTexto(e.target.value); setParcial(''); }}
        placeholder="A transcrição aparece aqui…"
        style={{ width: '100%', minHeight: 200, padding: 12, borderRadius: 'var(--raio-lg)', fontSize: 15, lineHeight: 1.6 }}
      />

      {resumo && (
        <div className="cartao" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Resumo</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{resumo.texto}</p>
          {resumo.pontos.length > 0 && (
            <>
              <h4>Pontos de atenção</h4>
              <ul>{resumo.pontos.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
          <small className="mudo">Gerado por {resumo.modelo}</small>
        </div>
      )}
    </>
  );
}
