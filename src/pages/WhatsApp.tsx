import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Banco, Mensagem, nomeCliente, nomeCorretor, novoId, useBanco } from '../store';
import { alarmesProtocolo, CategoriaMensagem, classificar, respostaPronta, ROTULO_CATEGORIA } from '../lib/whatsapp';
import { faseAtual } from '../lib/etapas';
import { formatar, hoje } from '../lib/datas';
import { Campo, Segmentos, Topo, Vazio } from '../components/ui';
import { somenteDigitos } from '../lib/cpf';

const COR: Record<CategoriaMensagem, string> = { andamento: 'violeta', protocolo: 'ambar', documentos: 'verde', audiencia: 'vermelho', outros: '' };

function montarResposta(b: Banco, msg: Mensagem): string {
  const cliente = b.clientes.find((c) => c.id === msg.clienteId);
  const proc = cliente ? b.processos.find((p) => p.clienteId === cliente.id) : undefined;
  const ultimaEtapa = proc ? [...proc.etapas].sort((x, y) => y.data.localeCompare(x.data))[0] : undefined;
  const ultimaOficial = proc?.movimentosOficiais?.[0];
  const aud = proc ? b.audiencias.filter((a) => a.processoId === proc.id && a.data >= hoje()).sort((x, y) => x.data.localeCompare(y.data))[0] : undefined;
  const ultima = ultimaOficial && (!ultimaEtapa || ultimaOficial.data.slice(0, 10) > ultimaEtapa.data)
    ? { data: formatar(ultimaOficial.data.slice(0, 10)), descricao: ultimaOficial.nome }
    : ultimaEtapa ? { data: formatar(ultimaEtapa.data), descricao: ultimaEtapa.etapa + (ultimaEtapa.obs ? ` — ${ultimaEtapa.obs}` : '') } : undefined;
  return respostaPronta(msg.categoria, {
    nomeCliente: cliente?.nome || msg.nome,
    numeroProcesso: proc?.numero,
    faseAtual: proc ? faseAtual(proc.etapas) : undefined,
    ultimaMovimentacao: ultima,
    audiencia: aud ? { data: formatar(aud.data), hora: aud.hora, local: aud.local } : undefined,
    assinatura: b.config.nomeEscritorio,
  });
}

/** Liga a mensagem ao cliente pelo telefone; se vier de corretor, tenta achar o cliente citado no texto. */
function vincular(b: Banco, telefone: string, texto: string) {
  const tel = somenteDigitos(telefone).slice(-8);
  const corretor = b.corretores.find((k) => somenteDigitos(k.telefone).slice(-8) === tel);
  let cliente = b.clientes.find((c) => somenteDigitos(c.telefone).slice(-8) === tel);
  if (!cliente && corretor) {
    const t = texto.toLowerCase();
    cliente = b.clientes.find((c) => t.includes(c.nome.split(' ')[0].toLowerCase()));
  }
  return { clienteId: cliente?.id ?? null, corretorId: corretor?.id ?? null };
}

export default function WhatsApp() {
  const b = useBanco();
  const [aba, setAba] = useState<'caixa' | 'protocolos'>('caixa');
  const [filtro, setFiltro] = useState<CategoriaMensagem | ''>('');
  const [sel, setSel] = useState<string | null>(b.mensagens[0]?.id ?? null);
  const [nova, setNova] = useState({ telefone: '', nome: '', texto: '' });

  const alarmes = useMemo(
    () => alarmesProtocolo(b.pedidos, (id) => nomeCliente(b, id), (id) => nomeCorretor(b, id)),
    [b],
  );
  const msgs = [...b.mensagens].filter((m) => !filtro || m.categoria === filtro).sort((x, y) => y.dataHora.localeCompare(x.dataHora));
  const atual = b.mensagens.find((m) => m.id === sel);

  const receber = () => {
    if (!nova.texto.trim()) return;
    const categoria = classificar(nova.texto);
    const v = vincular(b, nova.telefone, nova.texto);
    const id = novoId();
    alterar((db) => {
      db.mensagens.push({ id, dataHora: new Date().toISOString().slice(0, 16), telefone: nova.telefone, nome: nova.nome || nova.telefone, texto: nova.texto, categoria, ...v, respondida: false });
      if (categoria === 'protocolo' && v.clienteId) registrarPedido(db, v.clienteId, nova.nome || nova.telefone, v.corretorId);
    });
    setSel(id);
    setNova({ telefone: '', nome: '', texto: '' });
  };

  return (
    <>
      <Topo titulo="Central do WhatsApp" subtitulo="Classifica pedidos, liga ao processo e monta a resposta pronta.">
        <Segmentos valor={aba} aoMudar={setAba} opcoes={[['caixa', 'Mensagens'], ['protocolos', `Protocolos pedidos${alarmes.length ? ` · ${alarmes.length} alarme(s)` : ''}`]]} />
      </Topo>

      {alarmes.length > 0 && (
        <div className="aviso" style={{ marginBottom: 14 }}>
          <strong>Alarmes:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{alarmes.map((a, i) => <li key={i}>{a.texto}</li>)}</ul>
        </div>
      )}

      {aba === 'caixa' ? (
        <div className="grade g2">
          <div className="cartao">
            <div className="cartao-cab">
              <h3>Mensagens</h3>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as CategoriaMensagem | '')} style={{ width: 'auto' }}>
                <option value="">Todas</option>
                {Object.entries(ROTULO_CATEGORIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </div>
            {msgs.length === 0 ? <Vazio>Nenhuma mensagem.</Vazio> : (
              <ul className="lista">
                {msgs.map((m) => (
                  <li key={m.id} onClick={() => setSel(m.id)} style={{ cursor: 'pointer', background: sel === m.id ? 'var(--superficie-2)' : undefined, padding: '9px 6px', borderRadius: 6 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong>{m.nome}</strong> {m.corretorId && <span className="etiqueta">corretor</span>}
                      <div className="mudo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.texto}</div>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <span className={`etiqueta ${COR[m.categoria]}`}>{ROTULO_CATEGORIA[m.categoria]}</span>
                      <div className="mudo num">{m.dataHora.slice(11, 16)} {m.respondida ? '✓' : ''}</div>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt" style={{ borderTop: '1px solid var(--borda)', paddingTop: 12 }}>
              <h3 style={{ marginBottom: 8 }}>Receber mensagem (teste)</h3>
              <p className="mudo" style={{ margin: '0 0 8px' }}>Enquanto a API do WhatsApp não está ligada, cole aqui a mensagem para classificar.</p>
              <div className="linha-campos">
                <Campo rotulo="Telefone"><input value={nova.telefone} onChange={(e) => setNova({ ...nova, telefone: e.target.value })} placeholder="(91) 9…" /></Campo>
                <Campo rotulo="Nome"><input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></Campo>
              </div>
              <Campo rotulo="Mensagem"><textarea value={nova.texto} onChange={(e) => setNova({ ...nova, texto: e.target.value })} placeholder="doutor, como anda meu processo?" /></Campo>
              <div className="flex mt"><button className="btn primario" onClick={receber}>Classificar e receber</button></div>
            </div>
          </div>

          <div className="cartao">
            {!atual ? <Vazio>Escolha uma mensagem.</Vazio> : <DetalheMensagem key={`${atual.id}-${atual.categoria}-${atual.clienteId}`} b={b} m={atual} />}
          </div>
        </div>
      ) : (
        <CatalogoProtocolos b={b} />
      )}
    </>
  );
}

function registrarPedido(db: Banco, clienteId: string, solicitante: string, corretorId: string | null) {
  const h = hoje();
  const existente = db.pedidos.find((p) => p.clienteId === clienteId && (p.corretorId ?? null) === corretorId && p.situacao === 'pendente');
  if (existente) {
    existente.vezes += 1;
    existente.ultimoPedido = h;
  } else {
    db.pedidos.push({ id: novoId(), clienteId, solicitante, corretorId, vezes: 1, primeiroPedido: h, ultimoPedido: h, situacao: 'pendente' });
  }
}

function DetalheMensagem({ b, m }: { b: Banco; m: Mensagem }) {
  const [texto, setTexto] = useState(() => montarResposta(b, m));
  const [copiado, setCopiado] = useState(false);
  const cliente = b.clientes.find((c) => c.id === m.clienteId);
  const proc = cliente ? b.processos.find((p) => p.clienteId === cliente.id) : undefined;
  const link = `https://wa.me/55${somenteDigitos(m.telefone)}?text=${encodeURIComponent(texto)}`;

  return (
    <div key={m.id}>
      <div className="cartao-cab">
        <h3>{m.nome}</h3>
        <select
          value={m.categoria}
          style={{ width: 'auto' }}
          onChange={(e) => alterar((db) => { db.mensagens.find((x) => x.id === m.id)!.categoria = e.target.value as CategoriaMensagem; })}
          aria-label="Categoria"
        >
          {Object.entries(ROTULO_CATEGORIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <p className="pre">{m.texto}{m.temAnexo ? '\n📎 anexo' : ''}</p>
      <p className="mudo">
        {m.telefone} · {cliente ? <>cliente: <strong>{cliente.nome}</strong></> : 'cliente não identificado'}
        {m.corretorId && <> · corretor: {nomeCorretor(b, m.corretorId)}</>}
        {proc && <> · <Link to={`/processos/${proc.id}`}>{proc.numero}</Link></>}
      </p>
      {!cliente && (
        <Campo rotulo="Ligar ao cliente">
          <select value="" onChange={(e) => alterar((db) => { db.mensagens.find((x) => x.id === m.id)!.clienteId = e.target.value; })}>
            <option value="">Escolha…</option>
            {b.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      )}
      <h3 className="mt" style={{ marginBottom: 6 }}>Resposta pronta</h3>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} />
      <div className="flex mt">
        <button className="btn" onClick={() => setTexto(montarResposta(b, m))}>Remontar</button>
        <button className="btn" onClick={async () => { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>{copiado ? 'Copiado!' : 'Copiar'}</button>
        <a className="btn primario" href={link} target="_blank" rel="noreferrer" onClick={() => alterar((db) => { db.mensagens.find((x) => x.id === m.id)!.respondida = true; })}>Responder no WhatsApp</a>
      </div>
    </div>
  );
}

function CatalogoProtocolos({ b }: { b: Banco }) {
  const pedidos = [...b.pedidos].sort((x, y) => (x.situacao === y.situacao ? y.ultimoPedido.localeCompare(x.ultimoPedido) : x.situacao === 'pendente' ? -1 : 1));
  const marcar = (id: string) =>
    alterar((db) => {
      const p = db.pedidos.find((x) => x.id === id)!;
      p.situacao = 'protocolado';
      p.protocoladoEm = hoje();
      const proc = db.processos.find((x) => x.clienteId === p.clienteId);
      // Conta no Painel como processo protocolado
      db.registros.push({ id: novoId(), data: hoje(), tipo: 'protocolo', usuarioId: db.config.usuarioAtualId, processoId: proc?.id ?? null, descricao: `Pedido de ${p.solicitante}` });
      // Outros pedidos pendentes do mesmo cliente também ficam resolvidos
      db.pedidos.filter((x) => x.clienteId === p.clienteId && x.situacao === 'pendente').forEach((x) => { x.situacao = 'protocolado'; x.protocoladoEm = hoje(); });
    });
  return (
    <div className="cartao tabela-wrap">
      <h3>Catálogo de protocolos pedidos</h3>
      {pedidos.length === 0 ? <Vazio>Nenhum pedido.</Vazio> : (
        <table>
          <thead><tr><th>Cliente</th><th>Quem pediu</th><th>Vezes</th><th>Primeiro pedido</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{nomeCliente(b, p.clienteId)}</td>
                <td>{p.solicitante}{p.corretorId && <div className="mudo">corretor</div>}</td>
                <td className="num">{p.vezes > 1 ? <span className="etiqueta vermelho">pediu {p.vezes}x</span> : p.vezes}</td>
                <td className="num">{formatar(p.primeiroPedido)}</td>
                <td>{p.situacao === 'pendente' ? <span className="etiqueta ambar">pendente</span> : <span className="etiqueta verde">protocolado {formatar(p.protocoladoEm)}</span>}</td>
                <td>{p.situacao === 'pendente' && <button className="btn pequeno" onClick={() => marcar(p.id)}>Marcar protocolado</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
