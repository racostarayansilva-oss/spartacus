// Peças das tarefas: avatares, cartão do quadro, janela de detalhes (com comentários e histórico) e busca de processo.
import { MouseEvent, useMemo, useState } from 'react';
import { alterar, Banco, Etiqueta, nomeCliente, nomeUsuario, novoId, Tarefa, useBanco } from '../store';
import { hoje } from '../lib/datas';
import { anotar, atrasada, dataCurta, envolvidos, mudarSituacao, PONTOS, quandoLocal, ROTULO_PONTOS, ROTULO_SITUACAO, rotuloPrazo } from '../lib/tarefas';
import { normalizar } from '../lib/importacao';
import { Icone } from './icones';
import { Campo, cortar, Modal, Vazio } from './ui';
import { CampoMencao, TextoComMencao } from './Notificacoes';

// ---------- Avatares ----------

const CORES_AVATAR = ['#5b9cff', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#eab308', '#14b8a6'];

function corDoId(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}

/** "Dr. Rômulo Alves Costa" → "RC"; "Ana (Controladoria)" → "A" */
export function iniciais(nome: string): string {
  const partes = nome.replace(/\(.*?\)/g, '').replace(/^(dr|dra|sr|sra)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function Avatares({ b, ids, max = 3 }: { b: Banco; ids: string[]; max?: number }) {
  const mostrar = ids.slice(0, max);
  const resto = ids.length - mostrar.length;
  if (!ids.length) return <span className="mudo" style={{ fontSize: 12 }}>Sem responsável</span>;
  return (
    <span className="avatares" title={ids.map((id) => nomeUsuario(b, id)).join(', ')}>
      {mostrar.map((id) => <span key={id} className="avatar" style={{ background: corDoId(id) }}>{iniciais(nomeUsuario(b, id))}</span>)}
      {resto > 0 && <span className="avatar mais">+{resto}</span>}
    </span>
  );
}

// ---------- Etiquetas ----------

export const etiquetasDaTarefa = (b: Banco, t: Pick<Tarefa, 'etiquetas'>): Etiqueta[] =>
  (t.etiquetas || []).map((id) => (b.config.etiquetasTarefa || []).find((e) => e.id === id)).filter(Boolean) as Etiqueta[];

// ---------- Cartão do quadro ----------

export type AbaTarefa = 'detalhes' | 'comentarios' | 'historico';

export function CartaoTarefa({ b, t, aoAbrir, aoArrastar }: { b: Banco; t: Tarefa; aoAbrir: (aba: AbaTarefa) => void; aoArrastar?: () => void }) {
  const h = hoje();
  const proc = t.processoId ? b.processos.find((p) => p.id === t.processoId) : undefined;
  const etiquetas = etiquetasDaTarefa(b, t);
  const vencida = atrasada(t, h);
  const concluida = t.coluna === 'concluido';
  const acao = (aba: AbaTarefa) => (e: MouseEvent) => { e.stopPropagation(); aoAbrir(aba); };
  const concluir = (e: MouseEvent) => {
    e.stopPropagation();
    alterar((db) => { const x = db.tarefas.find((y) => y.id === t.id)!; mudarSituacao(x, concluida ? 'afazer' : 'concluido', db.config.usuarioAtualId, new Date().toISOString()); });
  };

  return (
    <div className="cartao-tarefa" draggable={!!aoArrastar} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; aoArrastar?.(); }} onClick={() => aoAbrir('detalhes')}
      role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && aoAbrir('detalhes')}>
      {etiquetas.length > 0 && (
        <div className="barras">{etiquetas.map((e) => <span key={e.id} style={{ background: e.cor }} title={e.nome} />)}</div>
      )}
      <div className="ct-titulo">
        <Icone nome="detalhe" tamanho={17} />
        <span style={{ minWidth: 0 }}>{t.titulo}</span>
        <span className="pontos" title={`${t.pontos} pontos (${ROTULO_PONTOS[t.pontos]})`}>{t.pontos}</span>
      </div>
      <div className="ct-sub">
        {proc ? <>{cortar(nomeCliente(b, proc.clienteId), 60)}<br /><span className="mono">{proc.numero}</span></> : t.descricao ? cortar(t.descricao, 90) : 'Sem processo'}
      </div>
      <div className={`ct-data${vencida ? ' vencida' : ''}`}>
        <Icone nome="relogio" tamanho={15} />
        {t.prazo ? rotuloPrazo(t.prazo, t.hora, h) : 'Sem prazo'}
        {t.coluna === 'revisao' && <span className="etiqueta ambar" style={{ marginLeft: 6 }}>em revisão</span>}
        {concluida && t.concluidaEm && <span className="etiqueta verde" style={{ marginLeft: 6 }}>concluída</span>}
      </div>
      <div className="ct-rodape">
        <Avatares b={b} ids={envolvidos(t)} />
        <span className="ct-acoes">
          <button onClick={concluir} title={concluida ? 'Reabrir' : 'Concluir'} aria-label={concluida ? 'Reabrir tarefa' : 'Concluir tarefa'} className={concluida ? 'feito' : ''}><Icone nome="concluir" tamanho={17} /></button>
          <button onClick={acao('detalhes')} title="Detalhes" aria-label="Detalhes"><Icone nome="detalhe" tamanho={17} /></button>
          <button onClick={acao('historico')} title="Histórico" aria-label="Histórico"><Icone nome="historico" tamanho={17} /></button>
          <button onClick={acao('comentarios')} title="Comentários" aria-label="Comentários">
            <Icone nome="comentario" tamanho={17} />{(t.comentarios || []).length > 0 && <small className="num">{t.comentarios!.length}</small>}
          </button>
        </span>
      </div>
    </div>
  );
}

// ---------- Busca de processo (milhares de processos) ----------

export function BuscaProcesso({ b, valor, aoMudar }: { b: Banco; valor: string | null | undefined; aoMudar: (id: string | null) => void }) {
  const [busca, setBusca] = useState('');
  const atual = b.processos.find((p) => p.id === valor);
  const opcoes = useMemo(() => {
    const t = normalizar(busca);
    const dig = busca.replace(/\D/g, '');
    if (!t) return [];
    return b.processos
      .filter((p) => (dig.length >= 4 && p.numero.replace(/\D/g, '').includes(dig)) || normalizar(nomeCliente(b, p.clienteId)).includes(t))
      .slice(0, 30);
  }, [b, busca]);

  if (atual) {
    return (
      <div className="flex entre" style={{ background: 'var(--superficie-2)', borderRadius: 'var(--raio-md)', padding: '6px 10px' }}>
        <span style={{ minWidth: 0 }}>{nomeCliente(b, atual.clienteId)} <span className="mono mudo">{atual.numero}</span></span>
        <button type="button" className="btn pequeno" onClick={() => aoMudar(null)}>Trocar</button>
      </div>
    );
  }
  return (
    <div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome do cliente ou o número…" />
      {opcoes.length > 0 && (
        <ul className="lista" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
          {opcoes.map((p) => (
            <li key={p.id} style={{ cursor: 'pointer' }} onClick={() => { aoMudar(p.id); setBusca(''); }}>
              <span>{nomeCliente(b, p.clienteId)}</span><span className="mono mudo">{p.numero}</span>
            </li>
          ))}
        </ul>
      )}
      {busca && !opcoes.length && <div className="mudo" style={{ fontSize: 12, marginTop: 4 }}>Nenhum processo encontrado.</div>}
    </div>
  );
}

// ---------- Janela da tarefa ----------

type Rascunho = Omit<Tarefa, 'id'> & { id?: string };

export function novaTarefa(b: Banco, extra: Partial<Tarefa> = {}): Partial<Tarefa> {
  return { coluna: 'afazer', pontos: 2, responsavelId: b.config.usuarioAtualId, participantes: [], prazo: hoje(), etiquetas: [], ...extra };
}

export function ModalTarefa({ tarefa, abaInicial = 'detalhes', aoFechar }: { tarefa: Partial<Tarefa>; abaInicial?: AbaTarefa; aoFechar: () => void }) {
  const b = useBanco();
  // Sempre a versão atual do banco (comentários de colegas chegam em tempo real)
  const gravada = tarefa.id ? b.tarefas.find((t) => t.id === tarefa.id) : undefined;
  const [aba, setAba] = useState<AbaTarefa>(tarefa.id ? abaInicial : 'detalhes');
  const [f, setF] = useState<Rascunho>({ titulo: '', ...(gravada || tarefa) } as Rascunho);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState('');
  const equipe = b.usuarios.filter((u) => u.papel !== 'cliente');
  const etiquetas = b.config.etiquetasTarefa || [];

  if (tarefa.id && !gravada) return <Modal titulo="Tarefa" aoFechar={aoFechar}><Vazio>Esta tarefa foi excluída.</Vazio></Modal>;

  const salvar = () => {
    if (!f.titulo.trim()) return setErro('Informe o título.');
    if (!f.responsavelId) return setErro('Escolha o responsável.');
    const agora = new Date().toISOString();
    const eu = b.config.usuarioAtualId;
    const dados = {
      titulo: f.titulo.trim(), descricao: (f.descricao || '').trim() || undefined, responsavelId: f.responsavelId,
      participantes: (f.participantes || []).filter((id) => id !== f.responsavelId), pontos: f.pontos,
      processoId: f.processoId || null, prazo: f.prazo || null, hora: f.prazo && f.hora ? f.hora : null, etiquetas: f.etiquetas || [],
    };
    alterar((db) => {
      const x = f.id ? db.tarefas.find((t) => t.id === f.id) : undefined;
      if (!x) {
        const t: Tarefa = { ...dados, id: novoId(), coluna: 'afazer', criadaEm: agora, criadaPor: eu, origem: 'manual', historico: [] };
        anotar(t, eu, 'Criou a tarefa', agora);
        mudarSituacao(t, f.coluna, eu, agora);
        db.tarefas.push(t);
        return;
      }
      const mudou: string[] = [];
      if (x.titulo !== dados.titulo) mudou.push('título');
      if ((x.descricao || '') !== (dados.descricao || '')) mudou.push('descrição');
      if (x.responsavelId !== dados.responsavelId) mudou.push(`responsável → ${nomeUsuario(db, dados.responsavelId)}`);
      if (JSON.stringify(x.participantes || []) !== JSON.stringify(dados.participantes)) mudou.push('pessoas');
      if ((x.prazo || null) !== dados.prazo || (x.hora || null) !== dados.hora) mudou.push(dados.prazo ? `prazo → ${dataCurta(dados.prazo)}${dados.hora ? ' ' + dados.hora : ''}` : 'prazo removido');
      if (x.pontos !== dados.pontos) mudou.push(`pontos → ${dados.pontos}`);
      if ((x.processoId || null) !== dados.processoId) mudou.push('processo');
      if (JSON.stringify(x.etiquetas || []) !== JSON.stringify(dados.etiquetas)) mudou.push('etiquetas');
      Object.assign(x, dados);
      if (mudou.length) anotar(x, eu, `Alterou ${mudou.join(', ')}`, agora);
      mudarSituacao(x, f.coluna, eu, agora);
    });
    aoFechar();
  };

  const excluir = () => {
    if (!confirm(`Excluir a tarefa "${f.titulo}"?`)) return;
    alterar((db) => { db.tarefas = db.tarefas.filter((t) => t.id !== f.id); });
    aoFechar();
  };

  const comentar = () => {
    const texto = comentario.trim();
    if (!texto || !gravada) return;
    alterar((db) => {
      const x = db.tarefas.find((t) => t.id === gravada.id)!;
      x.comentarios = [...(x.comentarios || []), { id: novoId(), em: new Date().toISOString(), usuarioId: db.config.usuarioAtualId, texto }];
    });
    setComentario('');
  };

  const alternar = (lista: string[] | undefined, id: string) => (lista || []).includes(id) ? (lista || []).filter((x) => x !== id) : [...(lista || []), id];
  const quando = quandoLocal;

  return (
    <Modal titulo={f.id ? 'Tarefa' : 'Nova tarefa'} aoFechar={aoFechar}>
      {f.id && (
        <div className="abas" role="tablist" style={{ marginBottom: 0 }}>
          <button role="tab" className={aba === 'detalhes' ? 'ativo' : ''} onClick={() => setAba('detalhes')}>Detalhes</button>
          <button role="tab" className={aba === 'comentarios' ? 'ativo' : ''} onClick={() => setAba('comentarios')}>Comentários<span className="contador">{(gravada?.comentarios || []).length}</span></button>
          <button role="tab" className={aba === 'historico' ? 'ativo' : ''} onClick={() => setAba('historico')}>Histórico<span className="contador">{(gravada?.historico || []).length}</span></button>
        </div>
      )}

      {aba === 'detalhes' && (
        <>
          <Campo rotulo="Título"><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoFocus={!f.id} placeholder="Ex.: Réplica à contestação" /></Campo>
          <Campo rotulo="Descrição (opcional; use @ para avisar alguém)"><CampoMencao valor={f.descricao || ''} aoMudar={(v) => setF({ ...f, descricao: v })} usuarios={b.usuarios} rows={3} rotulo="Descrição" /></Campo>
          <div className="linha-campos">
            <Campo rotulo="Situação">
              <select value={f.coluna} onChange={(e) => setF({ ...f, coluna: e.target.value as Tarefa['coluna'] })}>
                {Object.entries(ROTULO_SITUACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Prazo"><input type="date" value={f.prazo || ''} onChange={(e) => setF({ ...f, prazo: e.target.value || null })} /></Campo>
            <Campo rotulo="Hora (opcional)"><input type="time" value={f.hora || ''} onChange={(e) => setF({ ...f, hora: e.target.value || null })} disabled={!f.prazo} /></Campo>
            <Campo rotulo="Pontos">
              <select value={f.pontos} onChange={(e) => setF({ ...f, pontos: Number(e.target.value) as Tarefa['pontos'] })}>
                {PONTOS.map((p) => <option key={p} value={p}>{p} — {ROTULO_PONTOS[p]}</option>)}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Responsável principal (os pontos contam para ele)">
            <select value={f.responsavelId} onChange={(e) => setF({ ...f, responsavelId: e.target.value })}>
              <option value="">—</option>
              {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <div>
            <div className="mudo" style={{ fontSize: '0.88rem', marginBottom: 6 }}>Também nesta tarefa</div>
            <div className="flex">
              {equipe.filter((u) => u.id !== f.responsavelId).map((u) => {
                const on = (f.participantes || []).includes(u.id);
                return <button key={u.id} type="button" className={`btn pequeno${on ? ' primario' : ''}`} onClick={() => setF({ ...f, participantes: alternar(f.participantes, u.id) })}>{u.nome}</button>;
              })}
            </div>
          </div>
          <Campo rotulo="Processo (opcional)"><BuscaProcesso b={b} valor={f.processoId} aoMudar={(id) => setF({ ...f, processoId: id })} /></Campo>
          {etiquetas.length > 0 && (
            <div>
              <div className="mudo" style={{ fontSize: '0.88rem', marginBottom: 6 }}>Etiquetas</div>
              <div className="flex">
                {etiquetas.map((e) => {
                  const on = (f.etiquetas || []).includes(e.id);
                  return (
                    <button key={e.id} type="button" className="btn pequeno" onClick={() => setF({ ...f, etiquetas: alternar(f.etiquetas, e.id) })}
                      style={on ? { background: e.cor, borderColor: e.cor, color: '#181a20' } : { borderLeft: `4px solid ${e.cor}` }}>{e.nome}</button>
                  );
                })}
              </div>
            </div>
          )}
          {gravada?.criadaEm && (
            <p className="mudo" style={{ margin: 0, fontSize: 12 }}>
              Criada em {quando(gravada.criadaEm)}{gravada.criadaPor ? ` por ${nomeUsuario(b, gravada.criadaPor)}` : ''}{gravada.origem === 'intimacao' ? ' a partir de uma intimação' : ''}.
              {gravada.concluidaEm && ` Concluída em ${dataCurta(gravada.concluidaEm)}.`}
            </p>
          )}
          {erro && <div className="erro">{erro}</div>}
          <div className="modal-acoes">
            {f.id && <button className="btn perigo" onClick={excluir}>Excluir</button>}
            <button className="btn" onClick={aoFechar}>Cancelar</button>
            <button className="btn primario" onClick={salvar}>{f.id ? 'Salvar' : 'Criar tarefa'}</button>
          </div>
        </>
      )}

      {aba === 'comentarios' && gravada && (
        <>
          {(gravada.comentarios || []).length === 0 ? <Vazio>Nenhum comentário ainda.</Vazio> : (
            <ul className="lista">
              {gravada.comentarios!.map((c) => (
                <li key={c.id} style={{ alignItems: 'flex-start', gap: 10, justifyContent: 'flex-start' }}>
                  <Avatares b={b} ids={[c.usuarioId]} max={1} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{nomeUsuario(b, c.usuarioId)}</strong> <span className="mudo num" style={{ fontSize: 12 }}>{quando(c.em)}</span>
                    <div style={{ whiteSpace: 'pre-wrap' }}><TextoComMencao texto={c.texto} b={b} /></div>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <CampoMencao valor={comentario} aoMudar={setComentario} usuarios={b.usuarios} rows={3} rotulo="Novo comentário"
            placeholder="Escreva um comentário. Digite @ para mencionar e avisar alguém da equipe."
            aoTeclar={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) comentar(); }} />
          <div className="modal-acoes"><button className="btn primario" onClick={comentar} disabled={!comentario.trim()}>Comentar</button></div>
        </>
      )}

      {aba === 'historico' && gravada && (
        (gravada.historico || []).length === 0 ? <Vazio>Sem histórico. As alterações feitas a partir de agora ficam registradas aqui.</Vazio> : (
          <ul className="tempo">
            {[...gravada.historico!].reverse().map((h, i) => (
              <li key={i}>
                <strong>{h.texto}</strong>
                <div className="quando">{nomeUsuario(b, h.usuarioId)} · {quando(h.em)}</div>
              </li>
            ))}
          </ul>
        )
      )}
    </Modal>
  );
}
