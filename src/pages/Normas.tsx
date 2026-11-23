// Normas: busca em todo o catálogo de normas federais (Senado) + fichas do escritório.
// Uma busca acha a norma pelo número ("8.213/91"), pelo apelido ("CLT", "LOAS") ou pelo assunto ("aposentadoria rural").
import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { alterar, useBanco } from '../store';
import { AreaNorma, buscarFichas, FichaNorma } from '../lib/normas';
import { interpretar, normalizarTexto, ROTULO_TIPO_NORMA, TipoNorma } from '../lib/buscaNormas';
import { formatar, hoje, somarAnos, somarDias } from '../lib/datas';
import { api } from '../api';
import { Icone } from '../components/icones';
import { Modal, Topo, Vazio } from '../components/ui';

interface NormaResumo {
  id: string; tipo: TipoNorma; rotuloTipo: string; numero: string; data: string; nome: string; referencia: string; ementa: string; apelidos: string[];
}
interface Consulta { tipo?: TipoNorma; numero?: string; ano?: string; artigo?: string; termos: string[]; apelido?: unknown }
interface RespostaBusca { total: number; pagina: number; consulta: Consulta; itens: (NormaResumo & { principal?: boolean; parcial?: boolean })[] }
interface Info { total: number; gerado: string; porTipo: Record<string, number> }

const EXEMPLOS = ['lei 8.213', 'CLT', 'aposentadoria rural', 'art. 48 da 8213', 'salário-maternidade', 'EC 103/2019', 'LOAS', 'juizados especiais federais'];
const AREAS: AreaNorma[] = ['INSS', 'Previdenciário', 'Assistencial', 'CPC', 'JEF'];
const PERIODOS: [string, string][] = [['', 'Qualquer data'], ['1988', 'Desde a CF/88'], ['10a', 'Últimos 10 anos'], ['12m', 'Últimos 12 meses']];

function desdeDoPeriodo(p: string): string | undefined {
  if (p === '1988') return '1988-10-05';
  if (p === '10a') return somarAnos(hoje(), -10);
  if (p === '12m') return somarDias(hoje(), -365);
  return undefined;
}

/** Destaca as palavras buscadas no texto (sem diferenciar acento). */
function Destacar({ texto, termos }: { texto: string; termos: string[] }) {
  const ts = termos.map((t) => normalizarTexto(t).replace(/s$/, '')).filter((t) => t.length > 2);
  if (!ts.length || !texto) return <>{texto}</>;
  const norm = normalizarTexto(texto);
  // normalizarTexto mantém o tamanho (troca letra por letra), salvo espaços repetidos: usa o texto com espaços simples
  const base = texto.replace(/\s+/g, ' ').trim();
  const marcas: [number, number][] = [];
  for (const t of ts) {
    for (let i = norm.indexOf(t); i >= 0; i = norm.indexOf(t, i + t.length)) marcas.push([i, i + t.length]);
  }
  if (!marcas.length) return <>{base}</>;
  marcas.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  marcas.forEach(([a, b], k) => {
    if (a < pos) return;
    out.push(base.slice(pos, a), <mark key={k}>{base.slice(a, b)}</mark>);
    pos = b;
  });
  out.push(base.slice(pos));
  return <>{out}</>;
}

export default function Normas() {
  const b = useBanco();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') || '');
  const [tipo, setTipo] = useState<TipoNorma | ''>('');
  const [periodo, setPeriodo] = useState('');
  const [res, setRes] = useState<RespostaBusca | null>(null);
  const [mais, setMais] = useState<RespostaBusca['itens']>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [aberta, setAbertaEstado] = useState<{ id: string; artigo?: string } | null>(() => (params.get('norma') ? { id: params.get('norma')! } : null));
  // A norma aberta também fica no endereço: dá para mandar o link direto para um colega
  const setAberta = (a: { id: string; artigo?: string } | null) => {
    setAbertaEstado(a);
    const novo = new URLSearchParams(params);
    if (a) novo.set('norma', a.id); else novo.delete('norma');
    setParams(novo, { replace: true });
  };
  const [area, setArea] = useState<AreaNorma | ''>('');
  const entrada = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  // Já carrega o catálogo no servidor enquanto a pessoa digita
  useEffect(() => { api<Info>('normas/info').then(setInfo).catch((e) => setErro(e.message)); }, []);

  const buscar = async (pagina = 1) => {
    const termo = q.trim();
    if (!termo && !tipo) { setRes(null); setMais([]); return; }
    const meu = ++pedido.current;
    setCarregando(true);
    setErro('');
    try {
      const p = new URLSearchParams({ q: termo, pagina: String(pagina) });
      if (tipo) p.set('tipo', tipo);
      const desde = desdeDoPeriodo(periodo);
      if (desde) p.set('desde', desde);
      const r = await api<RespostaBusca>(`normas/busca?${p}`);
      if (meu !== pedido.current) return; // chegou uma busca mais nova
      if (pagina === 1) { setRes(r); setMais([]); } else { setMais((m) => [...m, ...r.itens]); setRes({ ...r, itens: res?.itens || [] }); }
    } catch (e: any) {
      if (meu === pedido.current) setErro(e.message);
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  };

  // Busca enquanto digita (com uma pausa curta) e guarda a busca no endereço (link compartilhável)
  useEffect(() => {
    const t = setTimeout(() => {
      buscar(1);
      if ((params.get('q') || '') !== q.trim()) {
        const novo = new URLSearchParams(params);
        if (q.trim()) novo.set('q', q.trim()); else novo.delete('q');
        setParams(novo, { replace: true });
      }
    }, q.trim() ? 280 : 0);
    return () => clearTimeout(t);
  }, [q, tipo, periodo]);

  const itens = [...(res?.itens || []), ...mais];
  const fichas = useMemo(() => (q.trim() ? buscarFichas(q, '').slice(0, 4) : []), [q]);
  const fixadas = b.config.normasFixadas || [];
  const semBusca = !q.trim() && !tipo;
  const c = res?.consulta;
  const leitura = c && [c.tipo && ROTULO_TIPO_NORMA[c.tipo], c.numero && `nº ${Number(c.numero).toLocaleString('pt-BR')}`, c.ano && `de ${c.ano}`, c.artigo && `abre no ${c.artigo.replace('art', 'art. ')}`].filter(Boolean).join(' · ');

  return (
    <>
      <Topo titulo="Normas" subtitulo={info ? `${info.total.toLocaleString('pt-BR')} normas federais para pesquisar · catálogo do Senado de ${formatar(info.gerado.slice(0, 10))}` : 'Legislação federal pesquisável e fichas do escritório.'} />

      <div className="busca-normas">
        <div className="busca-normas-campo">
          <Icone nome="busca" tamanho={20} />
          <input ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder="Número, apelido ou assunto: lei 8.213, CLT, aposentadoria rural, art. 48 da 8213…"
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(1); if (e.key === 'Escape') setQ(''); }} aria-label="Buscar normas" />
          {q && <button className="btn pequeno fantasma" onClick={() => { setQ(''); entrada.current?.focus(); }} aria-label="Limpar">✕</button>}
        </div>
        <div className="flex">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoNorma | '')} style={{ width: 'auto' }} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {(Object.keys(ROTULO_TIPO_NORMA) as TipoNorma[]).map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_NORMA[t]}{info?.porTipo[t] ? ` (${info.porTipo[t].toLocaleString('pt-BR')})` : ''}</option>
            ))}
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: 'auto' }} aria-label="Período">
            {PERIODOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          {leitura && <span className="mudo" style={{ fontSize: 13 }}>Entendi: <strong>{leitura}</strong></span>}
        </div>
        {semBusca && (
          <div className="flex" style={{ gap: 6 }}>
            <span className="mudo" style={{ fontSize: 13 }}>Experimente:</span>
            {EXEMPLOS.map((e) => <button key={e} className="btn pequeno" onClick={() => setQ(e)}>{e}</button>)}
          </div>
        )}
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {!semBusca && (
        <>
          {fichas.length > 0 && (
            <div className="cartao" style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 8 }}>Fichas do escritório</h3>
              <div className="grade g2" style={{ gap: 10 }}>{fichas.map((f) => <Ficha key={f.id} f={f} compacta />)}</div>
            </div>
          )}
          <div className="cartao">
            <div className="cartao-cab">
              <h3 style={{ marginBottom: 0 }}>{carregando && !res ? 'Buscando…' : `${(res?.total ?? 0).toLocaleString('pt-BR')} norma(s)`}</h3>
              {carregando && res && <span className="mudo" style={{ fontSize: 13 }}>atualizando…</span>}
            </div>
            {res && !res.total ? (
              <Vazio>Nada encontrado. Tente menos palavras, o número da norma (ex.: 8213) ou outro tipo.</Vazio>
            ) : (
              <ul className="resultados-normas">
                {itens.map((n, i) => (
                  <Fragment key={n.id}>
                    {n.parcial && !itens[i - 1]?.parcial && <li className="separador-parcial">Com parte das palavras</li>}
                    <li>
                      <button className="resultado-norma" onClick={() => setAberta({ id: n.id, artigo: res?.consulta.artigo })}>
                        <span className="rn-topo">
                          <span className="etiqueta violeta">{n.rotuloTipo}</span>
                          <strong>{n.referencia}</strong>
                          {n.principal && <span className="etiqueta verde">principal do assunto</span>}
                        </span>
                        {n.apelidos.length > 0 && <span className="rn-apelidos"><Destacar texto={n.apelidos.join(' · ')} termos={res?.consulta.termos || []} /></span>}
                        <span className="rn-ementa"><Destacar texto={n.ementa || 'Sem ementa no cadastro.'} termos={res?.consulta.termos || []} /></span>
                      </button>
                    </li>
                  </Fragment>
                ))}
              </ul>
            )}
            {res && itens.length < res.total && (
              <div className="flex mt" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => buscar(Math.floor(itens.length / 20) + 1)} disabled={carregando}>Mostrar mais ({(res.total - itens.length).toLocaleString('pt-BR')} restantes)</button>
              </div>
            )}
          </div>
        </>
      )}

      {semBusca && (
        <>
          {fixadas.length > 0 && (
            <div className="cartao" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Mais usadas pelo escritório</h3>
              <div className="flex" style={{ gap: 8 }}>
                {fixadas.map((f) => <button key={f.id} className="btn pequeno" onClick={() => setAberta({ id: f.id })} title={f.referencia}>{f.apelido || f.referencia}</button>)}
              </div>
            </div>
          )}
          <div className="aviso" style={{ marginBottom: 14 }}>
            <strong>Ponto de atenção:</strong> depois das ADIs 2110 e 2111 (STF), a carência do salário-maternidade mudou. Confirme a regra atual da IN para a segurada especial.
          </div>
          <div className="cartao-cab" style={{ marginBottom: 10 }}>
            <h2 style={{ marginBottom: 0 }}>Fichas do escritório</h2>
            <div className="segmentos">
              <button className={!area ? 'ativo' : ''} onClick={() => setArea('')}>Todas</button>
              {AREAS.map((a) => <button key={a} className={area === a ? 'ativo' : ''} onClick={() => setArea(a)}>{a}</button>)}
            </div>
          </div>
          <div className="grade g2">{buscarFichas('', area).map((f) => <Ficha key={f.id} f={f} />)}</div>
        </>
      )}

      {aberta && <DetalheNorma id={aberta.id} artigo={aberta.artigo || interpretar(q).artigo} aoFechar={() => setAberta(null)} />}
    </>
  );
}

// ---------- Ficha completa da norma ----------

interface Detalhe extends Partial<NormaResumo> {
  id: string; urn: string; normasLeg: string; senado: string; lexml: string;
  publicacoes: { tipo: string; descricao: string; data: string }[];
  relacoes: { id: string; norma: string; data: string; relacao: string; itens: string }[];
}
interface Texto { fonte: string; origem: string; texto: { id: string; texto: string; nivel: number }[] }

function DetalheNorma({ id: idInicial, artigo, aoFechar }: { id: string; artigo?: string; aoFechar: () => void }) {
  const b = useBanco();
  const [pilha, setPilha] = useState<string[]>([idInicial]);
  const id = pilha[pilha.length - 1];
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<'texto' | 'relacoes' | 'publicacao'>('texto');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setD(null);
    setErro('');
    api<Detalhe>(`normas/detalhe?id=${id}`).then(setD).catch((e) => setErro(e.message));
  }, [id]);

  const fixada = (b.config.normasFixadas || []).some((f) => f.id === id);
  const fixar = () => alterar((db) => {
    const l = db.config.normasFixadas || [];
    db.config.normasFixadas = fixada ? l.filter((f) => f.id !== id) : [...l, { id, referencia: d?.referencia || d?.nome || id, apelido: d?.apelidos?.[0] }];
  });
  const copiar = async () => {
    await navigator.clipboard.writeText(d?.referencia || d?.nome || '');
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };
  const grupos = useMemo(() => {
    const m = new Map<string, Detalhe['relacoes']>();
    for (const r of d?.relacoes || []) { const k = r.relacao || 'Outras'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return [...m.entries()].sort((a, c) => c[1].length - a[1].length);
  }, [d]);

  return (
    <Modal titulo={d?.referencia || 'Norma'} aoFechar={aoFechar} largo>
      {pilha.length > 1 && <button className="btn pequeno fantasma" style={{ alignSelf: 'flex-start' }} onClick={() => { setPilha(pilha.slice(0, -1)); setAba('texto'); }}>← Voltar</button>}
      {erro && <div className="erro">{erro}</div>}
      {!d && !erro && <div className="mudo">Carregando a ficha da norma…</div>}
      {d && (
        <>
          <div>
            <div className="flex" style={{ gap: 6, marginBottom: 6 }}>
              {d.rotuloTipo && <span className="etiqueta violeta">{d.rotuloTipo}</span>}
              {d.apelidos?.map((a) => <span key={a} className="etiqueta">{a}</span>)}
            </div>
            {d.ementa && <p style={{ margin: 0, lineHeight: 1.6 }}>{d.ementa}</p>}
          </div>
          <div className="flex">
            <button className="btn pequeno" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar referência'}</button>
            <button className={`btn pequeno${fixada ? ' primario' : ''}`} onClick={fixar} title="Atalho na tela de Normas para toda a equipe">{fixada ? '★ Fixada' : '☆ Fixar'}</button>
            {d.normasLeg && <a className="btn pequeno" href={d.normasLeg} target="_blank" rel="noreferrer">normas.leg.br ↗</a>}
            <a className="btn pequeno" href={d.senado} target="_blank" rel="noreferrer">Senado ↗</a>
            {d.lexml && <a className="btn pequeno" href={d.lexml} target="_blank" rel="noreferrer">LexML ↗</a>}
          </div>
          <div className="abas" role="tablist" style={{ marginBottom: 0 }}>
            <button role="tab" className={aba === 'texto' ? 'ativo' : ''} onClick={() => setAba('texto')}>Texto</button>
            <button role="tab" className={aba === 'relacoes' ? 'ativo' : ''} onClick={() => setAba('relacoes')}>Alterações e regulamentações<span className="contador">{d.relacoes.length}</span></button>
            <button role="tab" className={aba === 'publicacao' ? 'ativo' : ''} onClick={() => setAba('publicacao')}>Publicação<span className="contador">{d.publicacoes.length}</span></button>
          </div>
          {aba === 'texto' && (d.urn ? <TextoNorma key={d.urn} urn={d.urn} artigo={pilha.length === 1 ? artigo : undefined} senado={d.senado} /> : (
            <Vazio>O texto desta norma não está no normas.leg.br. Abra pelo link do Senado.</Vazio>
          ))}
          {aba === 'relacoes' && (!grupos.length ? <Vazio>Nenhuma alteração ou regulamentação registrada pelo Senado.</Vazio> : (
            <div className="grade" style={{ gap: 14 }}>
              {grupos.map(([g, rs]) => (
                <div key={g}>
                  <strong style={{ fontSize: 13 }}>{g} <span className="mudo num">({rs.length})</span></strong>
                  <ul className="lista">
                    {rs.map((r, i) => (
                      <li key={r.id + i} className={r.id ? 'clicavel' : ''} style={{ cursor: r.id ? 'pointer' : undefined }} onClick={() => r.id && (setPilha([...pilha, r.id]), setAba('texto'))}>
                        <span>{r.norma}{r.itens && <div className="mudo" style={{ fontSize: 12 }}>{r.itens}</div>}</span>
                        <span className="mudo num">{r.data}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
          {aba === 'publicacao' && (!d.publicacoes.length ? <Vazio>Sem dados de publicação.</Vazio> : (
            <ul className="lista">{d.publicacoes.map((p, i) => <li key={i}><span>{p.descricao}</span><span className="mudo num">{p.data}</span></li>)}</ul>
          ))}
          <p className="mudo" style={{ margin: 0, fontSize: 12 }}>Fontes: Senado Federal (cadastro, alterações e publicação) e normas.leg.br (texto, CC BY 4.0). Confira sempre a vigência no texto oficial.</p>
        </>
      )}
    </Modal>
  );
}

/** Texto inteiro com busca dentro dele e salto para um artigo. */
function TextoNorma({ urn, artigo, senado }: { urn: string; artigo?: string; senado: string }) {
  const [t, setT] = useState<Texto | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [atual, setAtual] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => { api<Texto>(`norma/texto?urn=${encodeURIComponent(urn)}`).then(setT).catch((e) => setErro(e.message)); }, [urn]);

  // "art 48", "artigo 201" vira salto para o artigo; outras palavras viram busca no texto
  const alvoArtigo = useMemo(() => {
    const m = normalizarTexto(busca).match(/^art(?:igo)?\.?\s*(\d+)(?:\s*-\s*([a-z]))?$/);
    return m ? `art${m[1]}${m[2] ? `-${m[2]}` : ''}` : artigo && !busca ? artigo : '';
  }, [busca, artigo]);
  const termo = alvoArtigo ? '' : normalizarTexto(busca);
  const achados = useMemo(() => (t && termo.length > 2 ? t.texto.map((p, i) => (normalizarTexto(p.texto).includes(termo) ? i : -1)).filter((i) => i >= 0) : []), [t, termo]);

  useEffect(() => { setAtual(0); }, [termo]);
  useEffect(() => {
    if (!t || !caixa.current) return;
    const alvo = alvoArtigo ? caixa.current.querySelector(`[data-art="${alvoArtigo}"]`) : achados.length ? caixa.current.querySelector(`[data-i="${achados[atual]}"]`) : null;
    alvo?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [t, alvoArtigo, achados, atual]);

  if (erro) return <div className="aviso">{erro} <a href={senado} target="_blank" rel="noreferrer">Abrir no Senado ↗</a></div>;
  if (!t) return <div className="mudo">Carregando o texto oficial (normas grandes levam alguns segundos)…</div>;
  return (
    <div className="grade" style={{ gap: 8 }}>
      <div className="flex">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no texto (ex.: carência) ou ir para um artigo (ex.: art 48)" style={{ flex: '1 1 260px' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && achados.length) setAtual((atual + 1) % achados.length); }} />
        {termo.length > 2 && (
          <>
            <span className="mudo num" style={{ fontSize: 13 }}>{achados.length ? `${atual + 1} de ${achados.length}` : 'nenhuma ocorrência'}</span>
            <button className="btn pequeno" disabled={!achados.length} onClick={() => setAtual((atual - 1 + achados.length) % achados.length)} aria-label="Anterior">‹</button>
            <button className="btn pequeno" disabled={!achados.length} onClick={() => setAtual((atual + 1) % achados.length)} aria-label="Próxima">›</button>
          </>
        )}
      </div>
      <div className="texto-norma lei" ref={caixa}>
        {t.texto.map((p, i) => (
          <p key={i} data-i={i} data-art={p.id || undefined} className={`n${Math.min(3, p.nivel)}${p.id && p.id === alvoArtigo ? ' alvo' : ''}${achados[atual] === i ? ' atual' : ''}`}>
            {termo.length > 2 ? <Destacar texto={p.texto} termos={[busca]} /> : p.texto}
          </p>
        ))}
      </div>
      <p className="mudo" style={{ margin: 0, fontSize: 12 }}>{t.texto.length.toLocaleString('pt-BR')} trechos · {t.origem === 'arvore' ? 'texto por dispositivos' : 'compilação vigente'} · <a href={t.fonte} target="_blank" rel="noreferrer">fonte ↗</a></p>
    </div>
  );
}

// ---------- Fichas do escritório ----------

function Ficha({ f, compacta = false }: { f: FichaNorma; compacta?: boolean }) {
  const [texto, setTexto] = useState<{ id: string; texto: string; nivel: number }[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  const verTexto = async () => {
    if (texto) return setTexto(null);
    setCarregando(true);
    setErro('');
    try {
      const r = await api<any>(`norma?urn=${encodeURIComponent(f.urn!)}&art=${f.art}`);
      setTexto(r.texto);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={compacta ? 'ficha-compacta' : 'cartao'}>
      <div className="cartao-cab">
        <h3 style={{ marginBottom: 4 }}>{f.titulo}</h3>
        <span className="etiqueta violeta">{f.area}</span>
      </div>
      <div className="mono mudo" style={{ fontSize: '0.82rem' }}>{f.referencia}</div>
      {!compacta && <p>{f.resumo}</p>}
      {compacta && <p className="mudo" style={{ fontSize: 13, margin: '6px 0' }}>{f.resumo.length > 160 ? f.resumo.slice(0, 160) + '…' : f.resumo}</p>}
      {f.atencao && !compacta && <div className="aviso" style={{ marginBottom: 10 }}>{f.atencao}</div>}
      <div className="flex">
        <button className="btn pequeno" onClick={async () => { await navigator.clipboard.writeText(f.referencia); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>{copiado ? 'Copiado!' : 'Copiar referência'}</button>
        <a className="btn pequeno" href={f.link} target="_blank" rel="noreferrer">Texto oficial ↗</a>
        {f.urn && f.art && <button className="btn pequeno" onClick={verTexto} disabled={carregando}>{carregando ? 'Carregando…' : texto ? 'Ocultar texto' : 'Ver texto da lei'}</button>}
      </div>
      {erro && <div className="erro mt">{erro}</div>}
      {texto && (
        <div className="lei mt pre" style={{ whiteSpace: 'normal', maxHeight: 360, overflowY: 'auto' }}>
          {texto.map((t, i) => <p key={i} className={`n${Math.min(3, t.nivel)}`}>{t.texto}</p>)}
          <p className="mudo" style={{ marginTop: 8 }}>Fonte: normas.leg.br (CC BY 4.0). Confira a vigência no texto oficial.</p>
        </div>
      )}
    </div>
  );
}
