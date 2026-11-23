// Aba "Revisar fases": mostra a fase que as movimentações indicam para cada processo e aplica em lote.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Banco, nomeCliente, Processo } from '../store';
import { aplicarSugestoes, faseComSugestoes, Sugestao } from '../lib/fases';
import { faseAtual, ROTULO_TIPO } from '../lib/etapas';
import { formatar } from '../lib/datas';
import { cortar, Paginacao, Vazio } from './ui';

export interface ItemFase { p: Processo; sugestoes: Sugestao[] }

export function ListaSugestoes({ sugestoes }: { sugestoes: Sugestao[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
      {sugestoes.map((s) => (
        <li key={s.etapa}>
          <details>
            <summary style={{ cursor: 'pointer' }}>
              <strong>{s.etapa}</strong>
              {s.resultado && <span className="etiqueta verde" style={{ marginLeft: 6 }}>{s.resultado}</span>}
              <span className="num mudo"> · {formatar(s.data)}</span>
            </summary>
            <div className="mudo" style={{ fontSize: 12, marginTop: 4 }}>
              <div>{s.fonte}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{s.trecho}</div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function RevisarFases({ b, itens }: { b: Banco; itens: ItemFase[] }) {
  const [filtro, setFiltro] = useState('');
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [msg, setMsg] = useState('');

  const comFase = useMemo(() => itens.map((x) => ({ ...x, nova: faseComSugestoes(x.p, x.sugestoes) })), [itens]);
  const porFase = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of comFase) m.set(x.nova, (m.get(x.nova) || 0) + 1);
    return [...m.entries()].sort((a, c) => c[1] - a[1]);
  }, [comFase]);

  const lista = comFase.filter((x) => !filtro || x.nova === filtro);
  const selecionados = lista.filter((x) => !desmarcados.has(x.p.id));
  const inicio = (Math.min(pagina, Math.max(1, Math.ceil(lista.length / porPagina))) - 1) * porPagina;
  const visiveis = lista.slice(inicio, inicio + porPagina);

  const alternar = (id: string) => {
    const n = new Set(desmarcados);
    if (n.has(id)) n.delete(id); else n.add(id);
    setDesmarcados(n);
  };
  const marcarTodos = (marcar: boolean) => {
    const n = new Set(desmarcados);
    for (const x of lista) if (marcar) n.delete(x.p.id); else n.add(x.p.id);
    setDesmarcados(n);
  };

  const aplicar = () => {
    if (!selecionados.length) return;
    const etapas = selecionados.reduce((s, x) => s + x.sugestoes.length, 0);
    if (!confirm(`Registrar ${etapas} etapa(s) em ${selecionados.length} processo(s)? Elas ficam marcadas como "identificadas pelas movimentações" e podem ser corrigidas ou removidas na ficha. Não contam como produção no Painel.`)) return;
    alterar((db) => { for (const x of selecionados) aplicarSugestoes(db, x.p.id, x.sugestoes); });
    setMsg(`${selecionados.length} processo(s) atualizados.`);
    setPagina(1);
  };

  if (!itens.length) {
    return (
      <div className="cartao">
        {msg && <div className="aviso" style={{ marginBottom: 12 }}>{msg}</div>}
        <Vazio>Nenhuma fase nova para revisar. As sugestões aparecem quando chegam movimentações (importação pela OAB, DataJud ou Controladoria) que indicam uma etapa ainda não registrada.</Vazio>
      </div>
    );
  }

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>Revisar fases</h3>
          <div className="mudo">
            Fases identificadas pelas comunicações do DJEN, pelo DataJud e pelas intimações. Confira o trecho de cada etapa (clique nela) e aplique.
            A leitura usa o começo de cada comunicação; quando ela não diz o que aconteceu, a etapa não aparece aqui.
          </div>
        </div>
      </div>
      {msg && <div className="aviso mt">{msg}</div>}

      <div className="flex mt">
        <button className={`btn pequeno${!filtro ? ' primario' : ''}`} onClick={() => { setFiltro(''); setPagina(1); }}>Todas <span className="num">{comFase.length}</span></button>
        {porFase.map(([fase, n]) => (
          <button key={fase} className={`btn pequeno${filtro === fase ? ' primario' : ''}`} onClick={() => { setFiltro(fase); setPagina(1); }}>
            {fase} <span className="num">{n}</span>
          </button>
        ))}
      </div>

      <div className="flex mt">
        <button className="btn pequeno" onClick={() => marcarTodos(true)}>Marcar todos</button>
        <button className="btn pequeno" onClick={() => marcarTodos(false)}>Desmarcar todos</button>
        <span style={{ flex: 1 }} />
        <button className="btn primario" onClick={aplicar} disabled={!selecionados.length}>Aplicar nos {selecionados.length} selecionados</button>
      </div>

      <div className="tabela-wrap mt">
        <table>
          <thead><tr><th style={{ width: 36 }}></th><th>Processo</th><th>Fase atual → sugerida</th><th>Etapas identificadas</th></tr></thead>
          <tbody>
            {visiveis.map(({ p, sugestoes, nova }) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={!desmarcados.has(p.id)} onChange={() => alternar(p.id)} aria-label={`Selecionar ${p.numero}`} /></td>
                <td style={{ minWidth: 220 }}>
                  <Link to={`/processos/${p.id}`}><strong>{cortar(nomeCliente(b, p.clienteId), 60)}</strong></Link>
                  <div className="mono mudo" style={{ fontSize: 12 }}>{p.numero} · {ROTULO_TIPO[p.tipo]}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="mudo">{faseAtual(p.etapas)}</span> → <strong>{nova}</strong>
                </td>
                <td style={{ minWidth: 260 }}><ListaSugestoes sugestoes={sugestoes} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao total={lista.length} pagina={pagina} porPagina={porPagina} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} nome="processos" />
    </div>
  );
}
