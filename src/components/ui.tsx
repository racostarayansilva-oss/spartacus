import { ReactNode, useEffect } from 'react';
import { Banco, ehDiamante } from '../store';

export function Topo({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="topo">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="subtitulo">{subtitulo}</p>}
      </div>
      {children && <div className="topo-acoes">{children}</div>}
    </div>
  );
}

export function Stat({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; alerta?: boolean }) {
  return (
    <div className={`cartao stat${alerta ? ' alerta' : ''}`}>
      <span className="rotulo">{rotulo}</span>
      <span className="valor">{valor}</span>
      {detalhe && <span className="detalhe">{detalhe}</span>}
    </div>
  );
}

export function Modal({ titulo, aoFechar, children, largo = false }: { titulo: string; aoFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal${largo ? ' largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="flex entre">
          <h2>{titulo}</h2>
          <button className="btn pequeno" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      {rotulo}
      {children}
    </label>
  );
}

export function Segmentos<T extends string>({ valor, opcoes, aoMudar }: { valor: T; opcoes: [T, string][]; aoMudar: (v: T) => void }) {
  return (
    <div className="segmentos" role="group">
      {opcoes.map(([v, r]) => (
        <button key={v} className={v === valor ? 'ativo' : ''} onClick={() => aoMudar(v)} type="button">
          {r}
        </button>
      ))}
    </div>
  );
}

/** Recursos exclusivos do plano Diamante. */
export function SoDiamante({ b, recurso, children }: { b: Banco; recurso: string; children: ReactNode }) {
  if (ehDiamante(b)) return <>{children}</>;
  return (
    <div className="cartao bloqueado">
      <strong>{recurso}</strong> está disponível no plano <strong>Diamante</strong>.
    </div>
  );
}

export const TagDiamante = () => <span className="diamante">Diamante</span>;

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

/** Paginação no estilo do Legis: "Exibir 25 · 1–25 de 2556 processos · « ‹ [1] de 103 › »" */
export function Paginacao({ total, pagina, porPagina, aoMudarPagina, aoMudarPorPagina, nome = 'itens' }: {
  total: number; pagina: number; porPagina: number;
  aoMudarPagina: (p: number) => void; aoMudarPorPagina: (n: number) => void; nome?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(pagina, paginas);
  const de = total ? (atual - 1) * porPagina + 1 : 0;
  const ate = Math.min(total, atual * porPagina);
  const ir = (p: number) => aoMudarPagina(Math.min(paginas, Math.max(1, p)));
  return (
    <div className="paginacao">
      <div className="lado">
        <span>Exibir:</span>
        <select value={porPagina} onChange={(e) => { aoMudarPorPagina(Number(e.target.value)); aoMudarPagina(1); }} aria-label="Itens por página">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="num">{de}–{ate} de {total} {nome}</span>
      </div>
      <div className="lado">
        <button className="btn" onClick={() => ir(1)} disabled={atual === 1} aria-label="Primeira página">«</button>
        <button className="btn" onClick={() => ir(atual - 1)} disabled={atual === 1} aria-label="Página anterior">‹</button>
        <input className="num" value={atual} onChange={(e) => { const n = Number(e.target.value); if (n) ir(n); }} aria-label="Página" />
        <span>de <span className="num">{paginas}</span></span>
        <button className="btn" onClick={() => ir(atual + 1)} disabled={atual === paginas} aria-label="Próxima página">›</button>
        <button className="btn" onClick={() => ir(paginas)} disabled={atual === paginas} aria-label="Última página">»</button>
      </div>
    </div>
  );
}

/** Corta o texto em até N caracteres sem quebrar palavra, com reticências. */
export function cortar(texto: string, max = 120): string {
  const t = (texto || '').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,;.—-]+$/, '') + '…';
}
