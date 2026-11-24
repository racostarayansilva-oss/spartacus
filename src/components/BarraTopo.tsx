// Barra do topo da área de trabalho: busca global (cliente, CPF, número do processo) e atalhos "Novo".
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBanco } from '../store';
import { buscarTudo } from '../lib/buscaGlobal';
import { Icone } from './icones';

export function BuscaGlobal() {
  const b = useBanco();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const resultados = useMemo(() => buscarTudo(b, q), [b.clientes, b.processos, q]);

  // Atalho: "/" ou Ctrl+K foca a busca
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = /input|textarea|select/i.test(alvo.tagName) || alvo.isContentEditable;
      if ((e.key === '/' && !digitando) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const ir = (rota: string) => { setQ(''); setAberto(false); campo.current?.blur(); nav(rota); };
  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && resultados[sel]) ir(resultados[sel].rota);
    else if (e.key === 'Escape') { setAberto(false); campo.current?.blur(); }
  };

  return (
    <div className="busca-global" role="search">
      <Icone nome="busca" tamanho={16} />
      <input
        ref={campo} value={q} placeholder="Buscar cliente, CPF ou número do processo"
        onChange={(e) => { setQ(e.target.value); setSel(0); setAberto(true); }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} onKeyDown={teclas}
        aria-label="Busca global" aria-expanded={aberto && resultados.length > 0} aria-controls="busca-global-lista" role="combobox"
      />
      <kbd className="busca-atalho" aria-hidden="true">/</kbd>
      {aberto && q.trim().length >= 2 && (
        <ul id="busca-global-lista" className="busca-global-lista" role="listbox">
          {resultados.length ? resultados.map((r, i) => (
            <li key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === sel}>
              <button type="button" className={i === sel ? 'ativo' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => ir(r.rota)} onMouseEnter={() => setSel(i)}>
                <Icone nome={r.tipo === 'cliente' ? 'clientes' : 'processos'} tamanho={16} />
                <span><b>{r.titulo}</b><small>{r.detalhe}</small></span>
              </button>
            </li>
          )) : <li className="busca-vazia">Nada encontrado para “{q.trim()}”.</li>}
        </ul>
      )}
    </div>
  );
}

const NOVOS: [string, string, string][] = [
  ['/clientes?novo=1', 'Cliente', 'clientes'],
  ['/processos?novo=1', 'Processo', 'processos'],
  ['/tarefas?nova=1', 'Atividade', 'tarefas'],
  ['/agenda', 'Prazo ou compromisso', 'agenda'],
  ['/documentos', 'Documento', 'documentos'],
];

export function NovoRapido() {
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  return (
    <div className="novo-rapido" ref={raiz}>
      <button className="btn destaque" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-haspopup="menu">
        <Icone nome="mais" tamanho={16} />Novo
      </button>
      {aberto && (
        <div className="novo-rapido-menu" role="menu">
          {NOVOS.map(([rota, rotulo, icone]) => (
            <button key={rota} role="menuitem" onClick={() => { setAberto(false); nav(rota); }}>
              <Icone nome={icone} tamanho={16} />{rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
