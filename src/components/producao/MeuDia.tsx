// Aba "Meu dia": o que a pessoa fez no dia (lançado + automático) e o relatório diário.
import { useMemo, useState } from 'react';
import { alterar, Atividade, Banco, nomeCliente, nomeUsuario, novoId, TipoAtividade, useBanco } from '../../store';
import { DataISO, hoje } from '../../lib/datas';
import {
  ehDiaUtil, formatarMinutos, idRelatorio, ItemProducao, itensDoPeriodo, pendenciasSugeridas, resumoAutomatico,
  sequencia, somaMinutos, somaPontos, TIPOS_ATIVIDADE,
} from '../../lib/producao';
import { Icone } from '../icones';
import { Campo, Modal, Segmentos, Stat } from '../ui';
import { equipeDe, horaDe, NavegadorData } from './Comum';

interface Props {
  pessoaId: string; aoMudarPessoa: (id: string) => void;
  data: DataISO; aoMudarData: (d: DataISO) => void;
  euId: string; admin: boolean;
}

export default function MeuDia({ pessoaId, aoMudarPessoa, data, aoMudarData, euId, admin }: Props) {
  const b = useBanco();
  const [editando, setEditando] = useState<Atividade | 'nova' | null>(null);
  const itens = useMemo(
    () => itensDoPeriodo(b, data, data, pessoaId).sort((x, y) => Number(x.concluido) - Number(y.concluido) || x.titulo.localeCompare(y.titulo)),
    [b, data, pessoaId],
  );
  const proprio = pessoaId === euId;
  const podeEditar = proprio || admin;
  const seq = sequencia(b.relatoriosDiarios, pessoaId);

  const concluir = (id: string) => alterar((db) => { const a = db.atividades.find((x) => x.id === id); if (a) a.status = 'concluida'; });
  const excluir = (i: ItemProducao) => {
    if (confirm(`Excluir "${i.titulo}"?`)) alterar((db) => { db.atividades = db.atividades.filter((x) => x.id !== i.id); });
  };

  return (
    <>
      <div className="prod-barra">
        <NavegadorData data={data} aoMudar={aoMudarData} />
        <div className="topo-acoes">
          {admin && (
            <select value={pessoaId} onChange={(e) => aoMudarPessoa(e.target.value)} aria-label="Pessoa" style={{ width: 'auto' }}>
              {equipeDe(b).map((u) => <option key={u.id} value={u.id}>{u.id === euId ? `${u.nome} (eu)` : u.nome}</option>)}
            </select>
          )}
          {podeEditar && (
            <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} />Registrar atividade</button>
          )}
        </div>
      </div>

      <div className="grade g4 manter">
        <Stat rotulo="Pontos no dia" valor={somaPontos(itens)} detalhe="Peso de cada entrega concluída" />
        <Stat rotulo="Entregas concluídas" valor={itens.filter((i) => i.concluido).length} detalhe={`${itens.filter((i) => !i.concluido).length} em andamento`} />
        <Stat rotulo="Tempo registrado" valor={formatarMinutos(somaMinutos(itens))} />
        <Stat rotulo="Sequência de relatórios" valor={<span className="flex" style={{ gap: 6 }}>{seq}<Icone nome="fogo" tamanho={20} /></span>} detalhe={seq === 1 ? 'dia útil seguido' : 'dias úteis seguidos'} />
      </div>

      <div className="grade prod-dia secao">
        <div className="cartao">
          <div className="cartao-cab">
            <h3>Atividades {proprio ? 'do meu dia' : `de ${nomeUsuario(b, pessoaId)}`}</h3>
            <span className="mudo">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <p className="mudo" style={{ margin: '0 0 8px' }}>Tarefas concluídas e movimentações registradas entram sozinhas — não precisa lançar de novo.</p>
          {itens.length === 0 ? (
            <div className="prod-vazio">
              <Icone nome="producao" tamanho={28} />
              <strong>Nada registrado neste dia</strong>
              <span>{podeEditar ? 'Lance cada atendimento, peça ou protocolo assim que terminar. Leva dez segundos.' : 'A pessoa ainda não lançou atividades.'}</span>
              {podeEditar && <button className="btn" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} />Registrar a primeira</button>}
            </div>
          ) : (
            <ul className="prod-lista">
              {itens.map((i) => (
                <li key={i.id} className={`prod-item${i.concluido ? '' : ' andamento'}`}>
                  <span className={`prod-icone ${i.origem}`}><Icone nome={i.icone} tamanho={18} /></span>
                  <div className="prod-corpo">
                    <div className="prod-titulo">{i.titulo}</div>
                    <div className="proc-meta">
                      <span>{i.tipo}</span>
                      {i.clienteId && <span>{nomeCliente(b, i.clienteId)}</span>}
                      {i.processoId && <span className="mono">{b.processos.find((p) => p.id === i.processoId)?.numero}</span>}
                      {i.minutos > 0 && <span className="flex" style={{ gap: 4 }}><Icone nome="relogio" tamanho={13} />{formatarMinutos(i.minutos)}</span>}
                    </div>
                    {i.descricao && <div className="prod-desc">{i.descricao}</div>}
                  </div>
                  <div className="prod-lado">
                    {i.concluido ? <span className="pontos">+{i.pontos} pts</span> : <span className="etiqueta ambar">Em andamento</span>}
                    {i.origem !== 'atividade' ? (
                      <span className="prod-auto" title="Veio das Tarefas ou das movimentações registradas">Automático</span>
                    ) : podeEditar && (
                      <div className="ct-acoes">
                        {!i.concluido && <button onClick={() => concluir(i.id)} title="Marcar como concluída" aria-label="Concluir"><Icone nome="concluir" tamanho={16} /></button>}
                        <button onClick={() => setEditando(b.atividades.find((a) => a.id === i.id)!)} title="Editar" aria-label="Editar"><Icone nome="editar" tamanho={16} /></button>
                        <button onClick={() => excluir(i)} title="Excluir" aria-label="Excluir"><Icone nome="lixeira" tamanho={16} /></button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <RelatorioDoDia key={`${pessoaId}:${data}`} b={b} pessoaId={pessoaId} data={data} itens={itens} podeEntregar={proprio} />
      </div>

      {editando && (
        <ModalAtividade
          inicial={editando === 'nova' ? undefined : editando}
          data={data} usuarioId={pessoaId} euId={euId} admin={admin}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

// ---------- Relatório do dia ----------

function RelatorioDoDia({ b, pessoaId, data, itens, podeEntregar }: { b: Banco; pessoaId: string; data: DataISO; itens: ItemProducao[]; podeEntregar: boolean }) {
  const existente = b.relatoriosDiarios.find((r) => r.id === idRelatorio(pessoaId, data));
  const [editando, setEditando] = useState(!existente && podeEntregar);
  const [resumo, setResumo] = useState(existente?.resumo ?? resumoAutomatico(itens));
  const [pendencias, setPendencias] = useState(existente?.pendencias ?? pendenciasSugeridas(b, pessoaId, data));
  const [amanha, setAmanha] = useState(existente?.amanha ?? '');

  const entregar = () => {
    const rel = {
      id: idRelatorio(pessoaId, data), data, usuarioId: pessoaId, entregueEm: new Date().toISOString(),
      resumo: resumo.trim(), pendencias: pendencias.trim() || undefined, amanha: amanha.trim() || undefined,
      pontos: somaPontos(itens), itens: itens.length,
    };
    alterar((db) => { db.relatoriosDiarios = [...db.relatoriosDiarios.filter((r) => r.id !== rel.id), rel]; });
    setEditando(false);
  };

  const selo = existente
    ? <span className="etiqueta verde"><Icone nome="concluir" tamanho={13} />Entregue às {horaDe(existente.entregueEm)}</span>
    : ehDiaUtil(data) && data <= hoje()
      ? <span className="etiqueta ambar">Pendente</span>
      : <span className="etiqueta">Opcional</span>;

  return (
    <div className="cartao relatorio-dia">
      <div className="cartao-cab">
        <h3>Relatório do dia</h3>
        {selo}
      </div>

      {editando ? (
        <div className="grade" style={{ gap: 12 }}>
          <Campo rotulo="O que foi feito">
            <textarea rows={7} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Resumo das entregas do dia" />
          </Campo>
          {itens.length > 0 && (
            <button className="btn fantasma pequeno" style={{ justifySelf: 'start', marginTop: -6 }} onClick={() => setResumo(resumoAutomatico(itens))}>
              <Icone nome="recarregar" tamanho={14} />Refazer com o que foi registrado
            </button>
          )}
          <Campo rotulo="Pendências e bloqueios">
            <textarea rows={3} value={pendencias} onChange={(e) => setPendencias(e.target.value)} placeholder="O que ficou parado e por quê" />
          </Campo>
          <Campo rotulo="Plano para amanhã">
            <textarea rows={3} value={amanha} onChange={(e) => setAmanha(e.target.value)} placeholder="Prioridades do próximo dia" />
          </Campo>
          <div className="modal-acoes" style={{ marginTop: 0 }}>
            {existente && <button className="btn" onClick={() => setEditando(false)}>Cancelar</button>}
            <button className="btn primario" onClick={entregar} disabled={!resumo.trim()}>
              <Icone nome="enviar" tamanho={15} />{existente ? 'Reenviar relatório' : 'Entregar relatório'}
            </button>
          </div>
        </div>
      ) : existente ? (
        <div className="relatorio-leitura">
          <section><h4>O que foi feito</h4><p>{existente.resumo}</p></section>
          {existente.pendencias && <section><h4>Pendências e bloqueios</h4><p>{existente.pendencias}</p></section>}
          {existente.amanha && <section><h4>Plano para amanhã</h4><p>{existente.amanha}</p></section>}
          <div className="relatorio-rodape">
            <span className="mudo">{existente.itens} itens · {existente.pontos} pts no envio</span>
            {podeEntregar && <button className="btn pequeno" onClick={() => setEditando(true)}><Icone nome="editar" tamanho={14} />Editar</button>}
          </div>
        </div>
      ) : (
        <div className="prod-vazio" style={{ padding: '20px 8px' }}>
          <strong>Relatório ainda não entregue</strong>
          <span>Só {nomeUsuario(b, pessoaId)} pode entregar o próprio relatório.</span>
        </div>
      )}
    </div>
  );
}

// ---------- Registrar / editar atividade ----------

const TEMPOS: [number, string][] = [[15, '15min'], [30, '30min'], [60, '1h'], [120, '2h']];

function ModalAtividade({ inicial, data, usuarioId, euId, admin, aoFechar }: {
  inicial?: Atividade; data: DataISO; usuarioId: string; euId: string; admin: boolean; aoFechar: () => void;
}) {
  const b = useBanco();
  const vazio = (): Atividade => ({ id: '', data, usuarioId, tipo: 'atendimento', titulo: '', status: 'concluida', minutos: 30, clienteId: null, processoId: null, criadaEm: '' });
  const [a, setA] = useState<Atividade>(inicial ?? vazio());
  const [aviso, setAviso] = useState('');
  const mudar = (p: Partial<Atividade>) => setA((x) => ({ ...x, ...p }));

  const rotulosCliente = useMemo(() => new Map(b.clientes.map((c) => [c.nome, c.id])), [b.clientes]);
  const rotuloProcesso = (id: string) => { const p = b.processos.find((x) => x.id === id); return p ? `${p.numero} — ${nomeCliente(b, p.clienteId)}` : ''; };
  const rotulosProcesso = useMemo(() => new Map(b.processos.map((p) => [`${p.numero} — ${nomeCliente(b, p.clienteId)}`, p.id])), [b]);
  const [textoCliente, setTextoCliente] = useState(a.clienteId ? nomeCliente(b, a.clienteId) : '');
  const [textoProcesso, setTextoProcesso] = useState(a.processoId ? rotuloProcesso(a.processoId) : '');

  const salvar = (outra: boolean) => {
    if (!a.titulo.trim()) return setAviso('Diga em poucas palavras o que foi feito.');
    const final: Atividade = {
      ...a, titulo: a.titulo.trim(), descricao: a.descricao?.trim() || undefined,
      clienteId: rotulosCliente.get(textoCliente.trim()) ?? null,
      processoId: rotulosProcesso.get(textoProcesso.trim()) ?? null,
      id: a.id || novoId(), criadaEm: a.criadaEm || new Date().toISOString(), criadaPor: a.criadaPor || euId,
    };
    alterar((db) => {
      const i = db.atividades.findIndex((x) => x.id === final.id);
      if (i >= 0) db.atividades[i] = final; else db.atividades.push(final);
    });
    if (!outra) return aoFechar();
    setA({ ...vazio(), tipo: a.tipo, usuarioId: a.usuarioId, data: a.data });
    setTextoCliente(''); setTextoProcesso(''); setAviso('Salva. Pode lançar a próxima.');
  };

  return (
    <Modal titulo={inicial ? 'Editar atividade' : 'Registrar atividade'} aoFechar={aoFechar}>
      <div>
        <span className="rotulo-campo">Tipo</span>
        <div className="tipo-grade" role="radiogroup" aria-label="Tipo de atividade">
          {(Object.keys(TIPOS_ATIVIDADE) as TipoAtividade[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={a.tipo === t} className={a.tipo === t ? 'ativo' : ''} onClick={() => mudar({ tipo: t })}>
              <Icone nome={TIPOS_ATIVIDADE[t].icone} tamanho={16} />
              <span>{TIPOS_ATIVIDADE[t].rotulo}</span>
              <small>{TIPOS_ATIVIDADE[t].peso} pt{TIPOS_ATIVIDADE[t].peso > 1 ? 's' : ''}</small>
            </button>
          ))}
        </div>
      </div>
      <Campo rotulo="O que foi feito">
        <input autoFocus value={a.titulo} onChange={(e) => { mudar({ titulo: e.target.value }); setAviso(''); }} placeholder="Ex.: Petição de juntada do CNIS — Maria" maxLength={140} />
      </Campo>
      <Campo rotulo="Detalhes (opcional)">
        <textarea rows={3} value={a.descricao ?? ''} onChange={(e) => mudar({ descricao: e.target.value })} placeholder="Resultado, próximo passo, observações" />
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Cliente (opcional)">
          <input list="prod-clientes" value={textoCliente} onChange={(e) => setTextoCliente(e.target.value)} placeholder="Digite o nome" />
        </Campo>
        <Campo rotulo="Processo (opcional)">
          <input list="prod-processos" value={textoProcesso} onChange={(e) => setTextoProcesso(e.target.value)} placeholder="Número ou cliente" />
        </Campo>
      </div>
      <datalist id="prod-clientes">{b.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
      <datalist id="prod-processos">{[...rotulosProcesso.keys()].map((r) => <option key={r} value={r} />)}</datalist>
      <div className="linha-campos" style={{ alignItems: 'end' }}>
        <div className="campo-bloco">
          <span className="rotulo-campo">Tempo gasto</span>
          <div className="flex" style={{ flexWrap: 'nowrap' }}>
            <Segmentos valor={String(a.minutos ?? 0)} aoMudar={(v) => mudar({ minutos: Number(v) })} opcoes={TEMPOS.map(([m, r]) => [String(m), r])} />
            <input type="number" min={0} step={5} value={a.minutos ?? ''} onChange={(e) => mudar({ minutos: Number(e.target.value) || 0 })} aria-label="Minutos" style={{ width: 80 }} />
          </div>
        </div>
        <div className="campo-bloco">
          <span className="rotulo-campo">Situação</span>
          <Segmentos valor={a.status} aoMudar={(v) => mudar({ status: v })} opcoes={[['concluida', 'Concluída'], ['andamento', 'Em andamento']]} />
        </div>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Data"><input type="date" value={a.data} max={hoje()} onChange={(e) => mudar({ data: e.target.value || data })} /></Campo>
        {admin && (
          <Campo rotulo="Responsável">
            <select value={a.usuarioId} onChange={(e) => mudar({ usuarioId: e.target.value })}>
              {equipeDe(b).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
        )}
      </div>
      {aviso && <div className={aviso.startsWith('Salva') ? 'aviso' : 'erro'}>{aviso}</div>}
      <div className="modal-acoes">
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        {!inicial && <button className="btn" onClick={() => salvar(true)}>Salvar e lançar outra</button>}
        <button className="btn primario" onClick={() => salvar(false)}>Salvar</button>
      </div>
    </Modal>
  );
}
