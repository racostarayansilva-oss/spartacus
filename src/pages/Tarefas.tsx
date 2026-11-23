// Tarefas: quadro (Todas, Hoje, Próximos dias, Fazendo, Concluídas hoje), lista, visão geral, desempenho e etiquetas.
// Pontos pela complexidade (1, 2, 3, 5, 8) contam para o responsável principal.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { alterar, Banco, nomeCliente, novoId, Tarefa, useBanco, usuarioAtual } from '../store';
import { diasEntre, hoje, somarDias } from '../lib/datas';
import {
  atrasada, COLUNAS_QUADRO, ColunaQuadro, colunaDoQuadro, desempenho, envolvidos, filtrarTarefas, FiltroTarefas, inicioDoMes,
  moverNoQuadro, ordenarParaQuadro, ROTULO_SITUACAO, resumoTarefas, rotuloPrazo,
} from '../lib/tarefas';
import { CORES_ETIQUETA } from '../lib/dadosIniciais';
import { Icone } from '../components/icones';
import { AbaTarefa, Avatares, CartaoTarefa, etiquetasDaTarefa, ModalTarefa, novaTarefa } from '../components/TarefaUI';
import { ChipEtiqueta } from '../components/Etiquetas';
import { ImportarLegis } from '../components/ImportarLegis';
import { cortar, Paginacao, Segmentos, SoDiamante, Stat, TagDiamante, Topo, Vazio } from '../components/ui';

type Aba = 'geral' | 'lista' | 'quadro' | 'desempenho' | 'config';
const ABAS: [Aba, string][] = [['geral', 'Visão Geral'], ['lista', 'Lista'], ['quadro', 'Quadro'], ['desempenho', 'Desempenho'], ['config', 'Configurações']];

const CHAVE_PESSOA = 'ra-connect:tarefas:pessoa';
function lerPessoa(): string {
  try { return localStorage.getItem(CHAVE_PESSOA) ?? 'eu'; } catch { return 'eu'; }
}

/** Texto extra usado na busca: cliente e número do processo. */
const textoDoProcesso = (b: Banco) => {
  const porId = new Map(b.processos.map((p) => [p.id, p]));
  return (t: Tarefa) => {
    const p = t.processoId ? porId.get(t.processoId) : undefined;
    return p ? `${nomeCliente(b, p.clienteId)} ${p.numero} ${p.numero.replace(/\D/g, '')}` : '';
  };
};

export default function Tarefas() {
  const b = useBanco();
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.some(([a]) => a === params.get('aba')) ? params.get('aba') : 'quadro') as Aba;
  const irPara = (a: Aba) => setParams(a === 'quadro' ? {} : { aba: a }, { replace: true });

  const [busca, setBusca] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [pessoa, setPessoa] = useState(lerPessoa);
  const [etiqueta, setEtiqueta] = useState('');
  const [aberta, setAberta] = useState<{ t: Partial<Tarefa>; aba: AbaTarefa } | null>(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => { try { localStorage.setItem(CHAVE_PESSOA, pessoa); } catch { /* sem armazenamento */ } }, [pessoa]);

  const filtro: FiltroTarefas = { busca, pessoa, etiqueta, usuarioAtualId: b.config.usuarioAtualId };
  const extra = useMemo(() => textoDoProcesso(b), [b.processos, b.clientes]);
  const lista = useMemo(() => filtrarTarefas(b.tarefas, filtro, extra), [b.tarefas, busca, pessoa, etiqueta, b.config.usuarioAtualId, extra]);
  const h = hoje();
  const r = resumoTarefas(lista, h);

  // Alertas do escritório (os números vermelhos da barra)
  const intimacoes = b.intimacoes.filter((i) => i.status === 'nova').length;
  const prazos = b.compromissos.filter((c) => c.status === 'pendente' && c.data <= h).length;
  const audiencias = b.audiencias.filter((a) => a.data >= h && diasEntre(h, a.data) <= 7 && (!a.clienteContatado || !a.testemunhasConfirmadas)).length;

  const abrir = (t: Partial<Tarefa>, a: AbaTarefa = 'detalhes') => setAberta({ t, aba: a });
  const filtrosAtivos = (pessoa !== '' ? 1 : 0) + (etiqueta ? 1 : 0);

  return (
    <>
      <Topo titulo="Tarefas" subtitulo="Arraste os cartões entre as colunas. Pontos pela complexidade: 1, 2, 3, 5 ou 8.">
        {usuarioAtual(b)?.papel === 'advogado' && <button className="btn" onClick={() => setImportando(true)}>Importar do Legis</button>}
        <button className="btn primario" onClick={() => abrir(novaTarefa(b))}>+ Nova tarefa</button>
      </Topo>
      {importando && <ImportarLegis aoFechar={() => setImportando(false)} />}

      <div className="resumo-chips">
        <span className="chip-resumo" title="Concluídas neste mês"><Icone nome="feito" tamanho={18} /><b className="num">{r.finalizadas}</b> Finalizadas</span>
        <span className="chip-resumo" title="Ainda não concluídas"><Icone nome="relogio" tamanho={18} /><b className="num">{r.pendentes}</b> Pendentes</span>
        <span className="chip-resumo" title="Pontos das tarefas concluídas neste mês"><Icone nome="pontos" tamanho={18} /><b className="num">{r.pontos.toLocaleString('pt-BR')}</b> Pontos</span>
        {r.atrasadas > 0 && <span className="chip-resumo alerta"><b className="num">{r.atrasadas}</b> Atrasadas</span>}
      </div>

      <div className="barra-ferramentas">
        <button className={`btn fantasma${mostrarBusca || busca ? ' ligado' : ''}`} onClick={() => setMostrarBusca(!mostrarBusca)}><Icone nome="busca" tamanho={17} />Buscar</button>
        <button className={`btn fantasma${mostrarFiltro || filtrosAtivos ? ' ligado' : ''}`} onClick={() => setMostrarFiltro(!mostrarFiltro)}>
          <Icone nome="filtro" tamanho={17} />Filtrar{filtrosAtivos > 0 && <span className="contador-filtro num">{filtrosAtivos}</span>}
        </button>
        <span className="separador" />
        <Link to="/controladoria" className="icone-alerta" title="Intimações sem tratar"><Icone nome="caixa" tamanho={20} />{intimacoes > 0 && <span className="bolha num">{intimacoes}</span>}</Link>
        <Link to="/agenda" className="icone-alerta" title="Prazos vencendo hoje ou vencidos"><Icone nome="alvo" tamanho={20} />{prazos > 0 && <span className="bolha num">{prazos}</span>}</Link>
        <Link to="/painel" className="icone-alerta" title="Audiências nos próximos 7 dias sem contato"><Icone nome="martelo" tamanho={20} />{audiencias > 0 && <span className="bolha num">{audiencias}</span>}</Link>
        <button className="icone-alerta" title="Configurações das tarefas" onClick={() => irPara('config')}><Icone nome="config" tamanho={20} /></button>
      </div>

      {(mostrarBusca || busca) && (
        <div className="flex" style={{ marginBottom: 12 }}>
          <input autoFocus placeholder="Buscar por título, descrição, cliente ou número do processo…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: '1 1 280px', maxWidth: 560 }} />
          {busca && <button className="btn pequeno" onClick={() => setBusca('')}>Limpar</button>}
        </div>
      )}
      {mostrarFiltro && (
        <div className="flex" style={{ marginBottom: 12 }}>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={{ width: 'auto' }} aria-label="Pessoa">
            <option value="eu">Minhas tarefas</option>
            <option value="">Toda a equipe</option>
            {b.usuarios.filter((u) => u.papel !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} style={{ width: 'auto' }} aria-label="Etiqueta">
            <option value="">Etiqueta: todas</option>
            {(b.config.etiquetasTarefa || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {filtrosAtivos > 0 && <button className="btn pequeno" onClick={() => { setPessoa(''); setEtiqueta(''); }}>Limpar filtros</button>}
        </div>
      )}
      {!mostrarFiltro && pessoa === 'eu' && <p className="mudo" style={{ margin: '0 0 10px', fontSize: 13 }}>Mostrando <strong>suas tarefas</strong>. Use <em>Filtrar</em> para ver a equipe toda.</p>}

      <div className="abas" role="tablist">
        {ABAS.map(([a, rotulo]) => <button key={a} role="tab" className={aba === a ? 'ativo' : ''} onClick={() => irPara(a)}>{rotulo}</button>)}
      </div>

      {aba === 'geral' && <VisaoGeral b={b} lista={lista} aoAbrir={abrir} />}
      {aba === 'lista' && <ListaTarefas b={b} lista={lista} aoAbrir={abrir} />}
      {aba === 'quadro' && <Quadro b={b} lista={lista} aoAbrir={abrir} />}
      {aba === 'desempenho' && <Desempenho b={b} />}
      {aba === 'config' && <ConfigTarefas b={b} />}

      {aberta && <ModalTarefa key={aberta.t.id || 'nova'} tarefa={aberta.t} abaInicial={aberta.aba} aoFechar={() => setAberta(null)} />}
    </>
  );
}

type AoAbrir = (t: Partial<Tarefa>, aba?: AbaTarefa) => void;

// ---------- Quadro ----------

const LIMITE_COLUNA = 40;

function Quadro({ b, lista, aoAbrir }: { b: Banco; lista: Tarefa[]; aoAbrir: AoAbrir }) {
  const h = hoje();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ColunaQuadro | null>(null);
  const [todas, setTodas] = useState<Set<ColunaQuadro>>(new Set());

  const porColuna = useMemo(() => {
    const m = new Map<ColunaQuadro, Tarefa[]>(COLUNAS_QUADRO.map((c) => [c.id, []]));
    for (const t of lista) { const c = colunaDoQuadro(t, h); if (c) m.get(c)!.push(t); }
    for (const [c, ts] of m) ts.sort(c === 'concluidas' ? (x, y) => x.titulo.localeCompare(y.titulo) : ordenarParaQuadro);
    return m;
  }, [lista, h]);

  const soltar = (destino: ColunaQuadro) => {
    if (arrastando) alterar((db) => { const t = db.tarefas.find((x) => x.id === arrastando); if (t) moverNoQuadro(t, destino, h, db.config.usuarioAtualId, new Date().toISOString()); });
    setArrastando(null);
    setSobre(null);
  };

  return (
    <div className="quadro">
      {COLUNAS_QUADRO.map((c) => {
        const ts = porColuna.get(c.id)!;
        const visiveis = todas.has(c.id) ? ts : ts.slice(0, LIMITE_COLUNA);
        return (
          <section key={c.id} className={`quadro-col${sobre === c.id ? ' sobre' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (sobre !== c.id) setSobre(c.id); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
            onDrop={() => soltar(c.id)}>
            <header className="quadro-cab" title={c.dica}>
              <span className="anel" style={{ borderColor: c.cor }} />
              <span>{c.titulo}</span>
              <span className="contagem num">{ts.length}</span>
            </header>
            <div className="quadro-corpo">
              {visiveis.map((t) => <CartaoTarefa key={t.id} b={b} t={t} aoAbrir={(a) => aoAbrir(t, a)} aoArrastar={() => setArrastando(t.id)} />)}
              {!ts.length && <div className="quadro-vazio">{c.id === 'hoje' ? 'Nada para hoje.' : c.id === 'fazendo' ? 'Arraste para cá o que está fazendo.' : 'Nenhuma tarefa.'}</div>}
              {ts.length > visiveis.length && (
                <button className="btn pequeno" onClick={() => setTodas(new Set([...todas, c.id]))}>Mostrar mais {ts.length - visiveis.length}</button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- Lista ----------

function ListaTarefas({ b, lista, aoAbrir }: { b: Banco; lista: Tarefa[]; aoAbrir: AoAbrir }) {
  const h = hoje();
  const [situacao, setSituacao] = useState<'pendentes' | 'concluidas' | 'todas'>('pendentes');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const itens = lista
    .filter((t) => situacao === 'todas' || (situacao === 'concluidas' ? t.coluna === 'concluido' : t.coluna !== 'concluido'))
    .sort(situacao === 'concluidas' ? (x, y) => (y.concluidaEm || '').localeCompare(x.concluidaEm || '') : ordenarParaQuadro);
  const inicio = (Math.min(pagina, Math.max(1, Math.ceil(itens.length / porPagina))) - 1) * porPagina;
  const visiveis = itens.slice(inicio, inicio + porPagina);

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <Segmentos valor={situacao} aoMudar={(v) => { setSituacao(v); setPagina(1); }} opcoes={[['pendentes', 'Pendentes'], ['concluidas', 'Concluídas'], ['todas', 'Todas']]} />
        <span className="mudo num">{itens.length} tarefa(s)</span>
      </div>
      <div className="tabela-wrap mt">
        {!itens.length ? <Vazio>Nenhuma tarefa.</Vazio> : (
          <table>
            <thead><tr><th>Tarefa</th><th>Processo</th><th>Pessoas</th><th>Prazo</th><th>Situação</th><th style={{ textAlign: 'right' }}>Pontos</th></tr></thead>
            <tbody>
              {visiveis.map((t) => {
                const p = t.processoId ? b.processos.find((x) => x.id === t.processoId) : undefined;
                return (
                  <tr key={t.id} className="clicavel" onClick={() => aoAbrir(t)}>
                    <td style={{ minWidth: 220 }}>
                      <strong style={{ color: 'var(--texto-forte)' }}>{t.titulo}</strong>
                      {etiquetasDaTarefa(b, t).length > 0 && <div className="flex" style={{ gap: 4, marginTop: 4 }}>{etiquetasDaTarefa(b, t).map((e) => <ChipEtiqueta key={e.id} e={e} />)}</div>}
                    </td>
                    <td>{p ? <>{cortar(nomeCliente(b, p.clienteId), 40)}<div className="mono mudo" style={{ fontSize: 12 }}>{p.numero}</div></> : <span className="mudo">—</span>}</td>
                    <td><Avatares b={b} ids={envolvidos(t)} /></td>
                    <td className="num" style={{ whiteSpace: 'nowrap', color: atrasada(t, h) ? 'var(--vermelho)' : undefined }}>{t.prazo ? rotuloPrazo(t.prazo, t.hora, h) : '—'}</td>
                    <td><span className={`etiqueta ${t.coluna === 'concluido' ? 'verde' : t.coluna === 'afazer' ? '' : 'ambar'}`}>{ROTULO_SITUACAO[t.coluna]}</span></td>
                    <td className="num" style={{ textAlign: 'right' }}><span className="pontos">{t.pontos}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Paginacao total={itens.length} pagina={pagina} porPagina={porPagina} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} nome="tarefas" />
    </div>
  );
}

// ---------- Visão geral ----------

function VisaoGeral({ b, lista, aoAbrir }: { b: Banco; lista: Tarefa[]; aoAbrir: AoAbrir }) {
  const h = hoje();
  const r = resumoTarefas(lista, h);
  const proximos = lista.filter((t) => t.coluna !== 'concluido' && t.prazo && t.prazo > h && t.prazo <= somarDias(h, 7)).length;
  const atrasadas = lista.filter((t) => atrasada(t, h)).sort(ordenarParaQuadro);
  const paraHoje = lista.filter((t) => t.coluna !== 'concluido' && t.prazo === h).sort(ordenarParaQuadro);
  const equipe = desempenho(b.tarefas, b.usuarios.filter((u) => u.papel !== 'cliente'), inicioDoMes(h), h);

  const ListaCurta = ({ itens, vazio }: { itens: Tarefa[]; vazio: string }) =>
    itens.length === 0 ? <Vazio>{vazio}</Vazio> : (
      <ul className="lista">
        {itens.slice(0, 10).map((t) => (
          <li key={t.id} className="clicavel" style={{ cursor: 'pointer' }} onClick={() => aoAbrir(t)}>
            <span style={{ minWidth: 0 }}>{t.titulo}<div className="mudo" style={{ fontSize: 12 }}>{t.processoId ? nomeCliente(b, b.processos.find((p) => p.id === t.processoId)?.clienteId) : 'Sem processo'}</div></span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Avatares b={b} ids={envolvidos(t)} max={2} /><span className="num" style={{ color: atrasada(t, h) ? 'var(--vermelho)' : undefined, whiteSpace: 'nowrap' }}>{t.prazo ? rotuloPrazo(t.prazo, t.hora, h) : ''}</span></span>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <div className="grade g4 manter">
        <Stat rotulo="Atrasadas" valor={r.atrasadas} alerta={r.atrasadas > 0} />
        <Stat rotulo="Para hoje" valor={r.hoje} />
        <Stat rotulo="Próximos 7 dias" valor={proximos} />
        <Stat rotulo="Fazendo" valor={r.fazendo} detalhe="em andamento ou revisão" />
      </div>
      <div className="grade g2 secao">
        <div className="cartao"><h3>Atrasadas</h3><ListaCurta itens={atrasadas} vazio="Nenhuma tarefa atrasada." /></div>
        <div className="cartao"><h3>Para hoje</h3><ListaCurta itens={paraHoje} vazio="Nada com prazo hoje." /></div>
      </div>
      <div className="cartao secao tabela-wrap">
        <h3>Equipe neste mês</h3>
        <table>
          <thead><tr><th>Pessoa</th><th style={{ textAlign: 'right' }}>Em aberto</th><th style={{ textAlign: 'right' }}>Atrasadas</th><th style={{ textAlign: 'right' }}>Pontos em aberto</th><th style={{ textAlign: 'right' }}>Concluídas</th><th style={{ textAlign: 'right' }}>Pontos feitos</th></tr></thead>
          <tbody>
            {equipe.map((l) => (
              <tr key={l.u.id}>
                <td><span className="flex" style={{ gap: 8 }}><Avatares b={b} ids={[l.u.id]} max={1} />{l.u.nome}</span></td>
                <td className="num" style={{ textAlign: 'right' }}>{l.abertas}</td>
                <td className="num" style={{ textAlign: 'right', color: l.atrasadas ? 'var(--vermelho)' : undefined }}>{l.atrasadas}</td>
                <td className="num" style={{ textAlign: 'right' }}>{l.pontosAbertos}</td>
                <td className="num" style={{ textAlign: 'right' }}>{l.concluidas}</td>
                <td className="num" style={{ textAlign: 'right' }}><strong>{l.pontos}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Desempenho ----------

function Desempenho({ b }: { b: Banco }) {
  const h = hoje();
  const [periodo, setPeriodo] = useState<'7' | '30' | 'mes'>('mes');
  const desde = periodo === 'mes' ? inicioDoMes(h) : somarDias(h, -(Number(periodo) - 1));
  const linhas = desempenho(b.tarefas, b.usuarios.filter((u) => u.papel !== 'cliente'), desde, h);
  const producao = (id: string) => b.registros.filter((r) => r.usuarioId === id && r.data >= desde && r.data <= h).length;
  const max = Math.max(1, ...linhas.map((l) => l.pontos));
  return (
    <div className="cartao">
      <div className="cartao-cab">
        <h3>Placar de produtividade <TagDiamante /></h3>
        <Segmentos valor={periodo} aoMudar={setPeriodo} opcoes={[['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês']]} />
      </div>
      <SoDiamante b={b} recurso="Placar de produtividade">
        <div className="tabela-wrap mt">
          <table>
            <thead><tr><th>#</th><th>Pessoa</th><th style={{ width: '28%' }}>Pontos</th><th style={{ textAlign: 'right' }}>Concluídas</th><th style={{ textAlign: 'right' }}>No prazo</th><th style={{ textAlign: 'right' }}>Em aberto</th><th style={{ textAlign: 'right' }}>Atrasadas</th><th style={{ textAlign: 'right' }}>Produção registrada</th></tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.u.id}>
                  <td className="num">{i + 1}</td>
                  <td><span className="flex" style={{ gap: 8 }}><Avatares b={b} ids={[l.u.id]} max={1} />{l.u.nome}</span></td>
                  <td><div className="flex" style={{ gap: 8 }}><strong className="num" style={{ minWidth: 28 }}>{l.pontos}</strong><div className="barra" style={{ flex: 1 }}><span style={{ width: `${(l.pontos / max) * 100}%` }} /></div></div></td>
                  <td className="num" style={{ textAlign: 'right' }}>{l.concluidas}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{l.noPrazo === null ? '—' : `${l.noPrazo}%`}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{l.abertas} <span className="mudo">({l.pontosAbertos} pts)</span></td>
                  <td className="num" style={{ textAlign: 'right', color: l.atrasadas ? 'var(--vermelho)' : undefined }}>{l.atrasadas}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{producao(l.u.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mudo" style={{ margin: '10px 0 0', fontSize: 12 }}>Pontos e tarefas contam para o responsável principal. “No prazo” = concluídas até a data do prazo. “Produção registrada” vem do botão Registrar movimentação do Painel.</p>
      </SoDiamante>
    </div>
  );
}

// ---------- Configurações ----------

function ConfigTarefas({ b }: { b: Banco }) {
  const etiquetas = b.config.etiquetasTarefa || [];
  const [nova, setNova] = useState({ nome: '', cor: CORES_ETIQUETA[0] });
  const usos = (id: string) => b.tarefas.filter((t) => (t.etiquetas || []).includes(id)).length;
  const mudar = (id: string, m: { nome?: string; cor?: string }) =>
    alterar((db) => { const e = (db.config.etiquetasTarefa || []).find((x) => x.id === id); if (e) Object.assign(e, m); });
  const excluir = (id: string) => {
    const n = usos(id);
    if (n && !confirm(`A etiqueta está em ${n} tarefa(s). Excluir mesmo assim?`)) return;
    alterar((db) => {
      db.config.etiquetasTarefa = (db.config.etiquetasTarefa || []).filter((x) => x.id !== id);
      for (const t of db.tarefas) if (t.etiquetas?.includes(id)) t.etiquetas = t.etiquetas.filter((x) => x !== id);
    });
  };
  const criar = () => {
    const nome = nova.nome.trim().toUpperCase();
    if (!nome) return;
    alterar((db) => { db.config.etiquetasTarefa = [...(db.config.etiquetasTarefa || []), { id: novoId(), nome, cor: nova.cor }]; });
    setNova({ nome: '', cor: nova.cor });
  };

  return (
    <div className="grade g2">
      <div className="cartao">
        <h3>Etiquetas das tarefas</h3>
        <p className="mudo" style={{ marginTop: 0 }}>Aparecem como barrinhas coloridas no topo do cartão e servem de filtro.</p>
        <ul className="lista">
          {etiquetas.map((e) => (
            <li key={e.id}>
              <span className="flex" style={{ flex: 1 }}>
                <input type="color" value={e.cor} onChange={(ev) => mudar(e.id, { cor: ev.target.value })} style={{ width: 40, minHeight: 30, padding: 2 }} aria-label={`Cor de ${e.nome}`} />
                <input defaultValue={e.nome} onBlur={(ev) => { const n = ev.target.value.trim().toUpperCase(); if (n && n !== e.nome) mudar(e.id, { nome: n }); }} style={{ flex: 1, minWidth: 120 }} aria-label="Nome da etiqueta" />
                <span className="mudo num" style={{ fontSize: 12 }}>{usos(e.id)} tarefa(s)</span>
              </span>
              <button className="btn pequeno perigo" onClick={() => excluir(e.id)} aria-label={`Excluir ${e.nome}`}>✕</button>
            </li>
          ))}
        </ul>
        <div className="flex mt">
          <input type="color" value={nova.cor} onChange={(e) => setNova({ ...nova, cor: e.target.value })} style={{ width: 40, minHeight: 34, padding: 2 }} aria-label="Cor" />
          <input placeholder="Nova etiqueta" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && criar()} style={{ flex: 1 }} />
          <button className="btn" onClick={criar}>Adicionar</button>
        </div>
      </div>
      <div className="cartao">
        <h3>Como o quadro organiza</h3>
        <ul className="lista">
          {COLUNAS_QUADRO.map((c) => <li key={c.id}><span className="flex" style={{ gap: 8 }}><span className="anel" style={{ borderColor: c.cor }} /><strong>{c.titulo}</strong></span><span className="mudo" style={{ textAlign: 'right' }}>{c.dica}</span></li>)}
        </ul>
        <p className="mudo" style={{ marginBottom: 0, fontSize: 13 }}>
          Arrastar para <strong>Hoje</strong> põe o prazo em hoje; para <strong>Próximos dias</strong>, amanhã; para <strong>Todas</strong>, tira o prazo se ele estiver nos próximos 7 dias.
          Toda mudança fica no histórico da tarefa. Ao gerar um prazo na Controladoria, a tarefa é criada para o responsável.
        </p>
      </div>
    </div>
  );
}
