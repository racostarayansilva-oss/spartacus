// Central de notificações (sino) e campo de texto com menção por @.
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { alterar, Banco, Notificacao, nomeUsuario, Usuario, useBanco, usuarioAtual } from '../store';
import { partesComMencao, primeiroNome, TEXTO_TIPO } from '../lib/notificacoes';
import { Icone } from './icones';
import { AbaTarefa, Avatares, ModalTarefa } from './TarefaUI';
import { Segmentos, Vazio } from './ui';

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "agora", "há 5 min", "há 3 h", "ontem 14:20", "12/11 09:30" */
export function quandoRelativo(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.round((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === agora.toDateString()) return `há ${Math.round(min / 60)} h`;
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

export function minhasNotificacoes(b: Banco): Notificacao[] {
  const eu = b.config.usuarioAtualId;
  return b.notificacoes.filter((n) => n.paraId === eu).sort((x, y) => y.em.localeCompare(x.em));
}

/** Texto de comentário/descrição com as menções em destaque. */
export function TextoComMencao({ texto, b }: { texto: string; b: Banco }) {
  const eu = b.config.usuarioAtualId;
  return (
    <>
      {partesComMencao(texto, b.usuarios).map((p, i) =>
        p.usuarioId ? <span key={i} className={`mencao${p.usuarioId === eu ? ' eu' : ''}`} title={nomeUsuario(b, p.usuarioId)}>{p.texto}</span> : <span key={i}>{p.texto}</span>)}
    </>
  );
}

/** Textarea que sugere a equipe ao digitar @. Insere o primeiro nome (ou o nome completo, se houver dois iguais). */
export function CampoMencao({ valor, aoMudar, usuarios, rows = 3, placeholder, aoTeclar, rotulo }: {
  valor: string; aoMudar: (v: string) => void; usuarios: Usuario[]; rows?: number; placeholder?: string;
  aoTeclar?: (e: KeyboardEvent<HTMLTextAreaElement>) => void; rotulo?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [consulta, setConsulta] = useState<{ inicio: number; texto: string } | null>(null);
  const [sel, setSel] = useState(0);
  const equipe = usuarios.filter((u) => u.papel !== 'cliente');

  const nomeParaInserir = (u: Usuario) => {
    const p = primeiroNome(u.nome);
    return equipe.filter((x) => norm(primeiroNome(x.nome)) === norm(p)).length === 1 ? p : u.nome;
  };
  const opcoes = useMemo(() => {
    if (!consulta) return [];
    const q = norm(consulta.texto);
    return equipe.filter((u) => norm(u.nome).startsWith(q) || norm(primeiroNome(u.nome)).startsWith(q) || norm(u.nome).includes(' ' + q)).slice(0, 6);
  }, [consulta, equipe]);

  const atualizarConsulta = (texto: string, cursor: number) => {
    const antes = texto.slice(0, cursor);
    const m = antes.match(/(^|[^\p{L}\p{N}])@([\p{L}.() ]{0,30})$/u);
    if (m && !/ {2}|^ /.test(m[2])) { setConsulta({ inicio: cursor - m[2].length - 1, texto: m[2] }); setSel(0); } else setConsulta(null);
  };
  const escolher = (u: Usuario) => {
    if (!consulta) return;
    const el = ref.current;
    const fim = el?.selectionStart ?? valor.length;
    const inserir = `@${nomeParaInserir(u)} `;
    const novo = valor.slice(0, consulta.inicio) + inserir + valor.slice(fim);
    aoMudar(novo);
    setConsulta(null);
    requestAnimationFrame(() => { if (el) { el.focus(); const pos = consulta.inicio + inserir.length; el.setSelectionRange(pos, pos); } });
  };

  return (
    <div className="campo-mencao">
      <textarea
        ref={ref} value={valor} rows={rows} placeholder={placeholder} aria-label={rotulo}
        onChange={(e) => { aoMudar(e.target.value); atualizarConsulta(e.target.value, e.target.selectionStart); }}
        onKeyDown={(e) => {
          if (consulta && opcoes.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % opcoes.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + opcoes.length) % opcoes.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(opcoes[sel]); return; }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setConsulta(null); return; }
          }
          aoTeclar?.(e);
        }}
        onBlur={() => setTimeout(() => setConsulta(null), 150)}
        onClick={(e) => atualizarConsulta(e.currentTarget.value, e.currentTarget.selectionStart)}
      />
      {consulta && opcoes.length > 0 && (
        <ul className="mencao-opcoes" role="listbox" aria-label="Mencionar alguém">
          {opcoes.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === sel}>
              <button type="button" className={i === sel ? 'ativo' : ''} onMouseDown={(e) => { e.preventDefault(); escolher(u); }}>
                <span className="avatar-mini">{u.nome.replace(/^(dr|dra|sr|sra)\.?\s+/i, '').slice(0, 1)}</span>{u.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sino com contador; abre o painel lateral com os avisos. */
export function SinoNotificacoes({ compacto = false }: { compacto?: boolean }) {
  const b = useBanco();
  const [aberto, setAberto] = useState(false);
  const naoLidas = minhasNotificacoes(b).filter((n) => !n.lida).length;
  return (
    <>
      <button className={compacto ? 'sino-movel' : 'sino'} onClick={() => setAberto(true)} aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ''}`}>
        <Icone nome="sino" />
        {!compacto && 'Notificações'}
        {compacto && 'Avisos'}
        {naoLidas > 0 && <span className="sino-conta num">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>
      {aberto && createPortal(<PainelNotificacoes aoFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

function PainelNotificacoes({ aoFechar }: { aoFechar: () => void }) {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const nav = useNavigate();
  const [filtro, setFiltro] = useState<'todas' | 'naolidas'>('todas');
  const [tarefa, setTarefa] = useState<{ id: string; aba: AbaTarefa } | null>(null);
  const todas = minhasNotificacoes(b);
  const lista = (filtro === 'naolidas' ? todas.filter((n) => !n.lida) : todas).slice(0, 100);
  const naoLidas = todas.filter((n) => !n.lida).length;

  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !tarefa) aoFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar, tarefa]);

  const marcar = (ids: string[], lida: boolean) => alterar((db) => { db.notificacoes.forEach((n) => { if (ids.includes(n.id)) n.lida = lida; }); });
  const abrir = (n: Notificacao) => {
    if (!n.lida) marcar([n.id], true);
    if (n.tipo === 'aviso') {
      if (n.link) { aoFechar(); nav(n.link); }
      return;
    }
    setTarefa({ id: n.tarefaId, aba: n.comentarioId ? 'comentarios' : 'detalhes' });
  };
  const limparLidas = () => {
    if (confirm('Apagar todas as notificações já lidas?')) alterar((db) => { db.notificacoes = db.notificacoes.filter((n) => !(n.paraId === eu?.id && n.lida)); });
  };

  return (
    <>
      <div className="notif-fundo" onMouseDown={aoFechar} />
      <aside className="notif-painel" role="dialog" aria-label="Notificações">
        <header className="notif-cab">
          <h2>Notificações</h2>
          <button className="icone-btn" onClick={aoFechar} aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button>
        </header>
        <div className="notif-filtros">
          <Segmentos valor={filtro} aoMudar={setFiltro} opcoes={[['todas', 'Todas'], ['naolidas', `Não lidas (${naoLidas})`]]} />
          {naoLidas > 0 && <button className="btn pequeno fantasma" onClick={() => marcar(todas.filter((n) => !n.lida).map((n) => n.id), true)}>Marcar todas como lidas</button>}
        </div>
        {lista.length === 0 ? (
          <Vazio>{filtro === 'naolidas' ? 'Nada novo por aqui.' : 'Você será avisado quando alguém criar uma tarefa para você ou mencionar você com @.'}</Vazio>
        ) : (
          <ul className="notif-lista">
            {lista.map((n) => (
              <li key={n.id} className={n.lida ? '' : 'nao-lida'}>
                <button className="notif-item" onClick={() => abrir(n)}>
                  {n.deId === 'sistema'
                    ? <span className="avatares" title="Monitor automático"><span className="avatar" style={{ background: 'var(--borda)' }}><Icone nome="sino" tamanho={14} /></span></span>
                    : <Avatares b={b} ids={[n.deId]} max={1} />}
                  <span className="notif-texto">
                    {n.tipo === 'aviso'
                      ? <span><b>{n.tarefaTitulo}</b></span>
                      : <span><b>{nomeUsuario(b, n.deId)}</b> {TEXTO_TIPO[n.tipo]} <b>{n.tarefaTitulo}</b></span>}
                    {n.trecho && <span className="notif-trecho"><TextoComMencao texto={n.trecho} b={b} /></span>}
                    <span className="notif-quando">{n.tipo === 'aviso' ? 'Aviso' : n.tipo === 'mencao' ? (n.comentarioId ? 'Comentário' : 'Descrição') : 'Tarefa'} · {quandoRelativo(n.em)}</span>
                  </span>
                  {!n.lida && <i className="notif-ponto" aria-label="Não lida" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {todas.some((n) => n.lida) && <footer className="notif-rodape"><button className="btn pequeno fantasma" onClick={limparLidas}>Apagar as lidas</button></footer>}
      </aside>
      {tarefa && <ModalTarefa key={tarefa.id} tarefa={{ id: tarefa.id }} abaInicial={tarefa.aba} aoFechar={() => setTarefa(null)} />}
    </>
  );
}
