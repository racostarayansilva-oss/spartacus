// Resumo Inteligente do processo (gerado por IA, só quando alguém clica).
// Os pontos de atenção e a situação vêm das regras do sistema; a IA (Gemini) redige o texto.
import { useState } from 'react';
import { alterar, Processo, useBanco, usuarioAtual } from '../store';
import { hoje } from '../lib/datas';
import { montarDadosResumo, partesNegrito, ROTULO_SITUACAO_PROCESSO, situacaoDoProcesso } from '../lib/resumoProcesso';
import { quandoLocal } from '../lib/tarefas';
import { api } from '../api';
import { Icone } from './icones';

function IconeIA() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
      <path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6Z" />
    </svg>
  );
}

function TextoComNegrito({ texto }: { texto: string }) {
  return <>{partesNegrito(texto).map((p, i) => (p.negrito ? <strong key={i}>{p.t}</strong> : <span key={i}>{p.t}</span>))}</>;
}

export function ResumoInteligente({ p }: { p: Processo }) {
  const b = useBanco();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const r = p.resumoIA;
  const situacao = situacaoDoProcesso(p);

  const gerar = async () => {
    setGerando(true);
    setErro('');
    try {
      const dados = montarDadosResumo(b, p, hoje());
      const res = await api<{ texto: string; pontos: string[]; modelo: string }>('ia/resumo-processo', { method: 'POST', body: JSON.stringify({ dados }) });
      const eu = usuarioAtual(b);
      alterar((db) => {
        const x = db.processos.find((y) => y.id === p.id);
        if (x) x.resumoIA = { texto: res.texto, pontos: res.pontos, geradoEm: new Date().toISOString(), geradoPor: eu?.nome || '', modelo: res.modelo };
      });
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  };

  const descartar = () => {
    if (!confirm('Descartar o resumo deste processo?')) return;
    alterar((db) => { const x = db.processos.find((y) => y.id === p.id); if (x) delete x.resumoIA; });
  };

  return (
    <section className="resumo-ia" aria-label="Resumo Inteligente">
      <header className="resumo-ia-cab">
        <span className="resumo-ia-icone"><IconeIA /></span>
        <h3>Resumo Inteligente</h3>
        <span className="selo-ia"><IconeIA />GERADO POR IA</span>
      </header>

      {gerando && (
        <div className="resumo-ia-carregando" aria-live="polite">
          <span /><span /><span style={{ width: '62%' }} />
          <small>Lendo os dados do processo e escrevendo o resumo…</small>
        </div>
      )}

      {!gerando && r && (
        <>
          <p className="resumo-ia-texto"><TextoComNegrito texto={r.texto} /></p>
          {r.pontos.length > 0 && (
            <div className="resumo-ia-pontos">
              <strong>Pontos de atenção:</strong>{' '}
              {r.pontos.length === 1 ? <span>{r.pontos[0]}</span> : <ul>{r.pontos.map((t, i) => <li key={i}><TextoComNegrito texto={t} /></li>)}</ul>}
            </div>
          )}
        </>
      )}

      {!gerando && !r && (
        <div className="resumo-ia-vazio">
          <p>Um parágrafo com classe, assuntos, número, valor da causa, fase e órgão, mais os pontos de atenção do processo.</p>
          <button className="btn primario" onClick={gerar}><IconeIA />Gerar resumo</button>
          <small>Vai para a IA só o que é do processo: nada de nome, CPF ou telefone do cliente.</small>
        </div>
      )}

      {erro && <div className="erro" role="alert" style={{ marginTop: 12 }}>{erro}</div>}

      <span className={`selo-situacao ${situacao}`}><span className="ponto" />{ROTULO_SITUACAO_PROCESSO[situacao]}</span>

      {r && (
        <footer className="resumo-ia-rodape">
          <span title={`Por ${r.geradoPor || '—'} · ${r.modelo}`}><Icone nome="relogio" tamanho={15} />Atualizado {quandoLocal(r.geradoEm).replace(/ (\d{2}:\d{2})$/, ' às $1')}</span>
          <span className="resumo-ia-acoes">
            <button onClick={gerar} disabled={gerando}><Icone nome="recarregar" tamanho={16} />{gerando ? 'Gerando…' : 'Regenerar'}</button>
            <button onClick={descartar} disabled={gerando} className="descartar"><IconeLixeira />Descartar</button>
          </span>
        </footer>
      )}
    </section>
  );
}

function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
