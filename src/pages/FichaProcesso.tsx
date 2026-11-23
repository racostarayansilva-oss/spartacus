import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { alterar, nomeCliente, nomeCorretor, nomeUsuario, novoId, Processo, useBanco } from '../store';
import { ETAPAS, faseAtual, indicadoresFicha, LinhaVida, ROTULO_TIPO, vidaDoProcesso } from '../lib/etapas';
import { editarEtapa, excluirProcesso, partesDoAssunto, registrarEtapa, removerEtapa, vinculosDoProcesso } from '../lib/processos';
import { FormProcesso } from '../components/FormProcesso';
import { ResumoInteligente } from '../components/ResumoInteligente';
import { ValoresProcesso } from '../components/ValoresProcesso';
import { ListaSugestoes } from '../components/RevisarFases';
import { aplicarSugestoes, faseComSugestoes, ignorarSugestoes, sugerirEtapas, textosDoProcesso } from '../lib/fases';
import { triagemGrupoFamiliar, MembroFamilia, Sexo } from '../lib/triagem';
import { formatar, hoje, idade } from '../lib/datas';
import { moeda } from '../lib/honorarios';
import { parseCnj } from '../lib/cnj';
import { aplicarDataJud } from '../lib/monitor';
import { api } from '../api';
import { Campo, cortar, Stat, Vazio } from '../components/ui';
import { ultimaMovimentacao } from './Processos';
import { SeletorEtiquetas } from '../components/Etiquetas';
import { AbaTarefa, CartaoTarefa, ModalTarefa, novaTarefa } from '../components/TarefaUI';
import { ordenarParaQuadro } from '../lib/tarefas';
import type { Tarefa } from '../store';

/** Tarefas ligadas ao processo: abertas primeiro (por prazo), depois as concluídas. */
function TarefasDoProcesso({ p }: { p: Processo }) {
  const b = useBanco();
  const [aberta, setAberta] = useState<{ t: Partial<Tarefa>; aba: AbaTarefa } | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const todas = b.tarefas.filter((t) => t.processoId === p.id);
  const abertas = todas.filter((t) => t.coluna !== 'concluido').sort(ordenarParaQuadro);
  const concluidas = todas.filter((t) => t.coluna === 'concluido').sort((x, y) => (y.concluidaEm || '').localeCompare(x.concluidaEm || ''));
  return (
    <div className="cartao">
      <div className="cartao-cab">
        <h3>Tarefas do processo</h3>
        <button className="btn primario pequeno" onClick={() => setAberta({ t: novaTarefa(b, { processoId: p.id }), aba: 'detalhes' })}>+ Nova tarefa</button>
      </div>
      {!abertas.length ? <Vazio>Nenhuma tarefa em aberto.</Vazio> : (
        <div className="grade g3" style={{ gap: 10 }}>
          {abertas.map((t) => <CartaoTarefa key={t.id} b={b} t={t} aoAbrir={(a) => setAberta({ t, aba: a })} />)}
        </div>
      )}
      {concluidas.length > 0 && (
        <div className="mt">
          <button className="btn pequeno" onClick={() => setVerConcluidas(!verConcluidas)}>{verConcluidas ? 'Ocultar' : 'Ver'} {concluidas.length} concluída(s)</button>
          {verConcluidas && (
            <div className="grade g3 mt" style={{ gap: 10 }}>
              {concluidas.map((t) => <CartaoTarefa key={t.id} b={b} t={t} aoAbrir={(a) => setAberta({ t, aba: a })} />)}
            </div>
          )}
        </div>
      )}
      {aberta && <ModalTarefa key={aberta.t.id || 'nova'} tarefa={aberta.t} abaInicial={aberta.aba} aoFechar={() => setAberta(null)} />}
    </div>
  );
}

export default function FichaProcesso() {
  const { id } = useParams();
  const b = useBanco();
  const p = b.processos.find((x) => x.id === id);
  if (!p) return <div className="cartao"><Vazio>Processo não encontrado. <Link to="/processos">Voltar</Link></Vazio></div>;
  return <Ficha key={p.id} p={p} />;
}

function Ficha({ p }: { p: Processo }) {
  const b = useBanco();
  const [aba, setAba] = useState<'vida' | 'movimentacoes' | 'familia' | 'tarefas'>('vida');
  const [copiado, setCopiado] = useState(false);
  const [editar, setEditar] = useState(false);
  const nav = useNavigate();
  const h = hoje();

  const excluir = () => {
    const v = vinculosDoProcesso(b, p.id);
    const partes = [
      v.audiencias && `${v.audiencias} audiência(s) — serão apagadas`,
      v.compromissos && `${v.compromissos} prazo(s)/compromisso(s)`,
      v.tarefas && `${v.tarefas} tarefa(s)`,
      v.registros && `${v.registros} registro(s) de produção do Painel`,
      v.lancamentos && `${v.lancamentos} lançamento(s) financeiro(s)`,
    ].filter(Boolean);
    const aviso = partes.length
      ? `\n\nLigados a ele:\n• ${partes.join('\n• ')}\n\nPrazos, tarefas, produção e lançamentos continuam existindo, só sem o processo.`
      : '';
    if (!confirm(`Excluir o processo ${p.numero} (${nomeCliente(b, p.clienteId)})? Isso não pode ser desfeito.${aviso}`)) return;
    alterar((db) => excluirProcesso(db, p.id));
    nav('/processos');
  };
  const ultimaOficial = p.movimentosOficiais?.[0]?.data?.slice(0, 10);
  const ind = indicadoresFicha(p.etapas, h, ultimaOficial);
  const { classe, contra } = partesDoAssunto(p.assunto);
  const cliente = b.clientes.find((c) => c.id === p.clienteId);
  const parado = ind.diasParado ?? 0;

  return (
    <>
      <p style={{ margin: '0 0 12px' }}><Link to="/processos">← Processos e Casos</Link></p>

      <div className="ficha-cab">
        <div className="flex entre" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="ficha-numero">
              #{p.numero}
              <button className="btn pequeno fantasma" onClick={async () => { await navigator.clipboard.writeText(p.numero); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <h1>{nomeCliente(b, p.clienteId)}</h1>
            {contra && <div className="contra">x {contra}</div>}
            <div style={{ marginTop: 10 }}><SeletorEtiquetas b={b} p={p} /></div>
          </div>
          <div className="flex" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div className="flex">
              <button className="btn pequeno" onClick={() => setEditar(true)}>Editar</button>
              <button className="btn pequeno perigo" onClick={excluir}>Excluir</button>
            </div>
            <div className="flex">
              <span className="etiqueta violeta">{ROTULO_TIPO[p.tipo]}</span>
              <span className="etiqueta">{faseAtual(p.etapas)}</span>
            </div>
          </div>
        </div>

        {classe && <div className="ficha-assunto"><span className="mudo">Assunto: </span>{classe}</div>}

        <dl className="ficha-dados">
          <div><dt>Órgão / vara</dt><dd>{p.regiao || '—'}</dd></div>
          <div><dt>Responsável</dt><dd>{p.responsavelId ? nomeUsuario(b, p.responsavelId) : 'Sem responsável'}</dd></div>
          <div><dt>Corretor</dt><dd>{p.corretorId ? nomeCorretor(b, p.corretorId) : '—'}</dd></div>
          <div><dt>Valor da causa</dt><dd className="num">{p.valor ? moeda(p.valor) : '—'}</dd></div>
          <div><dt>Cliente</dt><dd>{cliente?.telefone || 'Sem telefone'}{cliente?.cpf ? ` · CPF ${cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : ''}</dd></div>
        </dl>
      </div>

      <div className="grade g4 manter secao">
        <Stat rotulo="Dias de vida" valor={ind.diasDeVida ?? '—'} />
        <Stat rotulo="Da entrada até a decisão" valor={ind.diasAteDecisao === null ? '—' : `${ind.diasAteDecisao} d`} />
        <Stat rotulo="Parado há" valor={ind.diasParado === null ? '—' : `${ind.diasParado} d`} alerta={parado > 60} />
        <Stat rotulo="Última movimentação" valor={<span style={{ fontSize: 20 }}>{formatar(ultimaMovimentacao(p))}</span>} />
      </div>

      <div className="grade ficha-resumo secao">
        <ResumoInteligente key={p.id} p={p} />
        <ValoresProcesso key={`${p.id}-${p.valor}-${JSON.stringify(p.provisionamento || {})}-${p.rpv?.atualizadoEm || ''}`} p={p} />
      </div>

      <div className="abas secao" role="tablist">
        <button role="tab" className={aba === 'vida' ? 'ativo' : ''} onClick={() => setAba('vida')}>Vida do processo</button>
        <button role="tab" className={aba === 'movimentacoes' ? 'ativo' : ''} onClick={() => setAba('movimentacoes')}>
          Movimentações<span className="contador">{p.movimentosOficiais?.length || 0}</span>
        </button>
        <button role="tab" className={aba === 'familia' ? 'ativo' : ''} onClick={() => setAba('familia')}>
          Grupo familiar<span className="contador">{p.grupoFamiliar.length}</span>
        </button>
        <button role="tab" className={aba === 'tarefas' ? 'ativo' : ''} onClick={() => setAba('tarefas')}>
          Tarefas<span className="contador">{b.tarefas.filter((t) => t.processoId === p.id && t.coluna !== 'concluido').length}</span>
        </button>
      </div>

      {aba === 'vida' && <VidaDoProcesso p={p} />}
      {aba === 'movimentacoes' && <Movimentacoes p={p} />}
      {aba === 'familia' && <GrupoFamiliar p={p} />}
      {aba === 'tarefas' && <TarefasDoProcesso p={p} />}

      {editar && <FormProcesso processo={p} aoFechar={() => setEditar(false)} />}
    </>
  );
}

function VidaDoProcesso({ p }: { p: Processo }) {
  const b = useBanco();
  const intimacoes = b.intimacoes.filter((i) => i.processoNumero.replace(/\D/g, '') === p.numero.replace(/\D/g, ''));
  const sugestoes = sugerirEtapas(p, textosDoProcesso(p, intimacoes));
  const vida = vidaDoProcesso(p.etapas);
  const feitas = new Set(p.etapas.map((e) => e.etapa));
  const pendentes = ETAPAS[p.tipo].filter((e) => !feitas.has(e));
  const [etapa, setEtapa] = useState(pendentes[0] || ETAPAS[p.tipo][0]);
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState('');
  const [resultado, setResultado] = useState('procedente');

  const [editando, setEditando] = useState<number | null>(null);

  const registrar = () => {
    // Sentença, recurso, DER, ajuizamento e audiência também alimentam o Painel
    alterar((db) => registrarEtapa(db, p.id, { etapa, data, obs: obs.trim() || undefined, resultado: etapa === 'Sentença' ? resultado : undefined }, db.config.usuarioAtualId, novoId));
    setObs('');
    const proxima = ETAPAS[p.tipo].find((e) => e !== etapa && !feitas.has(e));
    if (proxima) setEtapa(proxima);
  };

  const remover = (e: LinhaVida) => {
    if (!confirm(`Remover a etapa "${e.etapa}" de ${formatar(e.data)}? Se ela contou no Painel, sai de lá também.`)) return;
    alterar((db) => removerEtapa(db, p.id, e.indice));
  };

  return (
    <div className="cartao">
      <h3>Vida do processo</h3>
      {sugestoes.length > 0 && (
        <div className="aviso" style={{ margin: '10px 0 16px' }}>
          <div className="flex entre" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <strong>As movimentações indicam etapas ainda não registradas</strong>
              <div className="mudo" style={{ margin: '2px 0 8px' }}>Fase depois de aplicar: {faseComSugestoes(p, sugestoes)}. Clique numa etapa para ver o trecho.</div>
              <ListaSugestoes sugestoes={sugestoes} />
            </div>
            <div className="flex">
              <button className="btn pequeno primario" onClick={() => alterar((db) => aplicarSugestoes(db, p.id, sugestoes))}>Aplicar</button>
              <button className="btn pequeno" onClick={() => alterar((db) => ignorarSugestoes(db, p.id, sugestoes.map((s) => s.etapa)))}>Ignorar</button>
            </div>
          </div>
        </div>
      )}
      <ul className="tempo">
        {vida.map((e) => (
          <li key={e.indice}>
            {editando === e.indice ? (
              <EditarEtapa p={p} e={e} aoFechar={() => setEditando(null)} />
            ) : (
              <div className="flex entre" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{e.etapa}</strong>{e.resultado && <span className="etiqueta verde" style={{ marginLeft: 6 }}>{e.resultado}</span>}
                  <div className="quando">{formatar(e.data)}{e.diasDesdeAnterior !== null && ` · +${e.diasDesdeAnterior} dias`}</div>
                  {e.obs && <div className="mudo">{e.obs}</div>}
                </div>
                <div className="flex" style={{ gap: 4 }}>
                  <button className="btn pequeno fantasma" onClick={() => setEditando(e.indice)}>Corrigir</button>
                  <button className="btn pequeno perigo" onClick={() => remover(e)} aria-label={`Remover etapa ${e.etapa}`}>Remover</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {pendentes.map((e) => <li key={e} className="pendente"><span className="mudo">{e}</span></li>)}
      </ul>
      <div className="linha-campos mt" style={{ alignItems: 'end' }}>
        <Campo rotulo="Etapa">
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            {ETAPAS[p.tipo].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        {etapa === 'Sentença' && (
          <Campo rotulo="Resultado">
            <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="procedente">Procedente</option><option value="parcial">Parcial</option><option value="improcedente">Improcedente</option>
            </select>
          </Campo>
        )}
      </div>
      <div className="flex mt">
        <input placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} style={{ flex: 1 }} />
        <button className="btn primario" onClick={registrar}>Registrar etapa</button>
      </div>
    </div>
  );
}

/** Correção de uma etapa já registrada (etapa, data, resultado e observação). */
function EditarEtapa({ p, e, aoFechar }: { p: Processo; e: LinhaVida; aoFechar: () => void }) {
  const [f, setF] = useState({ etapa: e.etapa, data: e.data, resultado: e.resultado || 'procedente', obs: e.obs || '' });
  // Etapas antigas ou importadas podem ter nome fora da lista do tipo atual
  const opcoes = ETAPAS[p.tipo].includes(e.etapa) ? ETAPAS[p.tipo] : [e.etapa, ...ETAPAS[p.tipo]];
  const salvar = () => {
    if (!f.data) return;
    alterar((db) => editarEtapa(db, p.id, e.indice, f, db.config.usuarioAtualId, novoId));
    aoFechar();
  };
  return (
    <div className="grade" style={{ gap: 8 }}>
      <div className="linha-campos" style={{ alignItems: 'end' }}>
        <Campo rotulo="Etapa">
          <select value={f.etapa} onChange={(ev) => setF({ ...f, etapa: ev.target.value })}>
            {opcoes.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data"><input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Campo>
        {f.etapa === 'Sentença' && (
          <Campo rotulo="Resultado">
            <select value={f.resultado} onChange={(ev) => setF({ ...f, resultado: ev.target.value })}>
              <option value="procedente">Procedente</option><option value="parcial">Parcial</option><option value="improcedente">Improcedente</option>
            </select>
          </Campo>
        )}
      </div>
      <input placeholder="Observação (opcional)" value={f.obs} onChange={(ev) => setF({ ...f, obs: ev.target.value })} />
      <div className="flex">
        <button className="btn pequeno primario" onClick={salvar}>Salvar</button>
        <button className="btn pequeno" onClick={aoFechar}>Cancelar</button>
      </div>
    </div>
  );
}

/** Uma movimentação: data numa coluna, título em destaque e o texto inteiro legível (abre/fecha se for longo). */
function ItemMovimentacao({ data, titulo, texto }: { data?: string; titulo: string; texto?: string }) {
  const longo = (texto || '').length > 280;
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mov">
      <div className="mov-data">{formatar(data?.slice(0, 10))}</div>
      <div style={{ minWidth: 0 }}>
        <div className="mov-titulo">{titulo}</div>
        {texto && <div className="mov-texto">{longo && !aberto ? cortar(texto, 280) : texto}</div>}
        {longo && <button className="btn pequeno fantasma" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setAberto(!aberto)}>{aberto ? 'Mostrar menos' : 'Ler texto completo'}</button>}
      </div>
    </div>
  );
}

function Movimentacoes({ p }: { p: Processo }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const ehCnj = !!parseCnj(p.numero);

  const atualizar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const r = await api<any>(`processo/${encodeURIComponent(p.numero)}`);
      alterar((db) => {
        const x = db.processos.find((y) => y.id === p.id)!;
        Object.assign(x, aplicarDataJud(x, r, new Date().toISOString()).processo);
      });
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>Movimentações</h3>
          <div className="mudo">
            Comunicações do DJEN e movimentos do DataJud.
            {p.atualizadoDataJud && ` DataJud atualizado em ${formatar(p.atualizadoDataJud.slice(0, 10))} às ${p.atualizadoDataJud.slice(11, 16)}.`}
          </div>
        </div>
        <button className="btn primario" onClick={atualizar} disabled={!ehCnj || carregando}>{carregando ? 'Consultando…' : 'Atualizar pelo DataJud'}</button>
      </div>
      {!ehCnj && <p className="mudo">Requerimento administrativo (NB): o DataJud só cobre processos judiciais com número CNJ.</p>}
      {erro && <div className="erro mt">{erro}</div>}
      {!p.movimentosOficiais?.length ? <Vazio>Sem movimentações carregadas. O DataJud pode levar alguns dias para indexar processos novos.</Vazio> : (
        <div className="mt">
          {p.movimentosOficiais.map((m, i) => <ItemMovimentacao key={i} data={m.data} titulo={m.nome} texto={m.complemento} />)}
        </div>
      )}
    </div>
  );
}

function GrupoFamiliar({ p }: { p: Processo }) {
  const h = hoje();
  const tri = triagemGrupoFamiliar(p.grupoFamiliar, h);
  const vazio: Omit<MembroFamilia, 'id'> = { nome: '', parentesco: '', sexo: 'F', nascimento: '', ultimoParto: null, partoPrevisto: null };
  const [m, setM] = useState(vazio);

  const adicionar = () => {
    if (!m.nome.trim() || !m.nascimento) return;
    alterar((db) => { db.processos.find((y) => y.id === p.id)!.grupoFamiliar.push({ ...m, id: novoId() }); });
    setM(vazio);
  };
  const remover = (id: string) => alterar((db) => {
    const x = db.processos.find((y) => y.id === p.id)!;
    x.grupoFamiliar = x.grupoFamiliar.filter((g) => g.id !== id);
  });

  return (
    <div className="cartao secao">
      <h3>Grupo familiar (CadÚnico)</h3>
      <div className="tabela-wrap">
        {p.grupoFamiliar.length === 0 ? <Vazio>Nenhum membro cadastrado.</Vazio> : (
          <table>
            <thead><tr><th>Nome</th><th>Parentesco</th><th>Sexo</th><th>Nascimento</th><th>Idade</th><th>Último parto</th><th>Parto previsto</th><th></th></tr></thead>
            <tbody>
              {p.grupoFamiliar.map((g) => (
                <tr key={g.id}>
                  <td>{g.nome}</td><td>{g.parentesco}</td><td>{g.sexo}</td>
                  <td className="num">{formatar(g.nascimento)}</td><td className="num">{idade(g.nascimento, h)}</td>
                  <td className="num">{formatar(g.ultimoParto)}</td><td className="num">{formatar(g.partoPrevisto)}</td>
                  <td><button className="btn pequeno perigo" onClick={() => remover(g.id)} aria-label="Remover">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="linha-campos mt" style={{ alignItems: 'end' }}>
        <Campo rotulo="Nome"><input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} /></Campo>
        <Campo rotulo="Parentesco"><input value={m.parentesco} onChange={(e) => setM({ ...m, parentesco: e.target.value })} placeholder="Cônjuge, filha…" /></Campo>
        <Campo rotulo="Sexo"><select value={m.sexo} onChange={(e) => setM({ ...m, sexo: e.target.value as Sexo })}><option value="F">Feminino</option><option value="M">Masculino</option></select></Campo>
        <Campo rotulo="Nascimento"><input type="date" value={m.nascimento} onChange={(e) => setM({ ...m, nascimento: e.target.value })} /></Campo>
        {m.sexo === 'F' && <Campo rotulo="Último parto"><input type="date" value={m.ultimoParto || ''} onChange={(e) => setM({ ...m, ultimoParto: e.target.value || null })} /></Campo>}
        {m.sexo === 'F' && <Campo rotulo="Parto previsto"><input type="date" value={m.partoPrevisto || ''} onChange={(e) => setM({ ...m, partoPrevisto: e.target.value || null })} /></Campo>}
        <button className="btn" onClick={adicionar}>Adicionar</button>
      </div>

      <h3 className="mt" style={{ marginBottom: 8 }}>Triagem automática</h3>
      <div className="grade g3">
        <div>
          <strong>Aposentadoria rural (55 M / 60 H)</strong>
          {tri.aposentadoriaRural.length === 0 ? <Vazio>Ninguém atinge em 5 anos.</Vazio> : (
            <ul className="lista">
              {tri.aposentadoriaRural.map((a) => (
                <li key={a.membro.id}>
                  <span>{a.membro.nome}<div className="mudo">{a.idadeAtual} anos</div></span>
                  {a.situacao === 'atingiu' ? <span className="etiqueta verde">já atingiu</span> : <span className="etiqueta ambar num">completa {formatar(a.dataQueCompleta)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Salário-maternidade</strong>
          {tri.salarioMaternidade.length === 0 ? <Vazio>Sem partos em 5 anos nem gestantes.</Vazio> : (
            <ul className="lista">
              {tri.salarioMaternidade.map((s) => (
                <li key={s.membro.id + s.tipo}>
                  <span>{s.membro.nome}<div className="mudo">{s.tipo === 'parto' ? `parto ${formatar(s.data)}` : `gestante · parto previsto ${formatar(s.data)}`}</div></span>
                  <span className="etiqueta violeta num">até {formatar(s.dataLimite)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>BPC idoso (65+)</strong>
          {tri.bpcIdoso.length === 0 ? <Vazio>Ninguém com 65 anos ou mais.</Vazio> : (
            <ul className="lista">
              {tri.bpcIdoso.map((x) => <li key={x.membro.id}><span>{x.membro.nome}</span><span className="etiqueta verde">{x.idadeAtual} anos</span></li>)}
            </ul>
          )}
        </div>
      </div>
      <p className="mudo mt">A triagem aponta possibilidades pela idade e datas; carência, qualidade de segurado e renda familiar precisam de análise. Ver ADIs 2110 e 2111 sobre a carência do salário-maternidade.</p>
    </div>
  );
}
