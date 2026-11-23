import { useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Banco, ehDiamante, nomeCliente, nomeUsuario, Processo, SituacaoRpv, useBanco } from '../store';
import { DataISO, diasEntre, formatar, hoje, somarDias } from '../lib/datas';
import { moeda } from '../lib/honorarios';
import { Segmentos, Stat, Topo, SoDiamante, TagDiamante, Vazio } from '../components/ui';
import { RegistrarMovimentacao, ROTULO_REGISTRO, ROTULO_CANAL } from '../components/RegistrarMovimentacao';

type Periodo = 'hoje' | '7' | '30';

function inicioPeriodo(p: Periodo): DataISO {
  const h = hoje();
  return p === 'hoje' ? h : somarDias(h, -(Number(p) - 1));
}

function metricas(b: Banco, desde: DataISO) {
  const h = hoje();
  const regs = b.registros.filter((r) => r.data >= desde && r.data <= h);
  const conta = (t: string, f?: (r: (typeof regs)[0]) => boolean) => regs.filter((r) => r.tipo === t && (!f || f(r))).length;
  const sentencas = regs.filter((r) => r.tipo === 'sentenca');
  const proc = sentencas.filter((s) => s.resultado === 'procedente').length;
  const parc = sentencas.filter((s) => s.resultado === 'parcial').length;
  return {
    entradasWhats: conta('entrada', (r) => r.canal === 'whatsapp'),
    entradasTotal: conta('entrada'),
    protocolos: conta('protocolo'),
    audiencias: conta('audiencia'),
    recursos: conta('recurso'),
    dilacoes: conta('dilacao'),
    exigencias: conta('exigencia'),
    despachos: conta('despacho'),
    despachosFav: conta('despacho', (r) => r.resultado === 'favoravel'),
    sentencas: sentencas.length,
    procedentes: proc,
    parciais: parc,
    improcedentes: sentencas.filter((s) => s.resultado === 'improcedente').length,
    taxa: sentencas.length ? Math.round(((proc + parc) / sentencas.length) * 100) : null,
    regs,
  };
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const ROTULO_RPV: Record<SituacaoRpv, string> = {
  calculos: 'Cálculos / homologação', aguardando_expedicao: 'Aguardando expedição', expedida: 'Expedida (envio ao TRF1)', trf1: 'No TRF1 (pagamento)', paga: 'Paga',
};

/** Carteira: valor da causa, fase no Legis, acordos homologados e RPVs. */
function Carteira({ b }: { b: Banco }) {
  const procs = b.processos;
  const valorTotal = procs.reduce((s, p) => s + (p.valor || 0), 0);
  const comValor = procs.filter((p) => p.valor > 0).length;
  const fase = (f: Processo['faseLegis']) => procs.filter((p) => p.faseLegis === f).length;
  const acordo = (b.config.etiquetas || []).find((e) => norm(e.nome) === 'acordo homologado');
  const acordos = acordo ? procs.filter((p) => (p.etiquetas || []).includes(acordo.id)).length : 0;
  const rpvs = procs.filter((p) => p.rpv && p.rpv.situacao !== 'paga');
  const totalRpv = rpvs.reduce((s, p) => s + (p.rpv?.valor || 0), 0);
  const porSituacao = (Object.keys(ROTULO_RPV) as SituacaoRpv[])
    .map((s) => { const l = procs.filter((p) => p.rpv?.situacao === s); return { s, n: l.length, v: l.reduce((t, p) => t + (p.rpv?.valor || 0), 0) }; })
    .filter((x) => x.n > 0);
  if (!procs.length) return null;
  return (
    <div className="secao">
      <h2>Carteira de processos</h2>
      <div className="grade g4 manter mt">
        <Stat rotulo="Processos" valor={procs.length.toLocaleString('pt-BR')} detalhe={<Link to="/processos">abrir lista</Link>} />
        <Stat rotulo="Valor total da causa" valor={<span style={{ fontSize: '1.25rem' }}>{moeda(valorTotal)}</span>} detalhe={`${comValor.toLocaleString('pt-BR')} processo(s) com valor informado`} />
        <Stat rotulo="Por fase" valor={<span style={{ fontSize: '1.05rem' }}>{fase('instrucao')} · {fase('recursal')} · {fase('execucao')}</span>} detalhe="instrução · recursal · execução" />
        <Stat rotulo="Acordos homologados" valor={acordos} detalhe={acordo ? <Link to={`/processos?etiqueta=${acordo.id}`}>ver processos</Link> : 'etiqueta não criada'} />
      </div>
      {rpvs.length > 0 && (
        <div className="cartao mt">
          <div className="cartao-cab">
            <h3>RPVs em andamento</h3>
            <span className="num"><b>{moeda(totalRpv)}</b> <span className="mudo">em {rpvs.length} processo(s)</span></span>
          </div>
          <div className="grade g4 manter" style={{ marginTop: 8 }}>
            {porSituacao.map(({ s, n, v }) => <Stat key={s} rotulo={ROTULO_RPV[s]} valor={n} detalhe={moeda(v)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Painel() {
  const b = useBanco();
  const [periodo, setPeriodo] = useState<Periodo>('7');
  const [registrar, setRegistrar] = useState(false);
  const h = hoje();
  const m = metricas(b, inicioPeriodo(periodo));

  const prazosHoje = b.compromissos.filter((c) => c.status === 'pendente' && c.data === h);
  const vencidos = b.compromissos.filter((c) => c.status === 'pendente' && c.data < h);
  const intimacoesNovas = b.intimacoes.filter((i) => i.status === 'nova');
  const audSemContato = b.audiencias.filter((a) => a.data >= h && diasEntre(h, a.data) <= 7 && (!a.clienteContatado || !a.testemunhasConfirmadas));
  const aReceber = b.lancamentos.filter((l) => l.tipo === 'receita' && !l.pago).reduce((s, l) => s + l.valor, 0);
  const proximosPrazos = b.compromissos.filter((c) => c.status === 'pendente' && c.data >= h).sort((x, y) => x.data.localeCompare(y.data)).slice(0, 6);
  const ultimas = [...b.registros].sort((x, y) => y.data.localeCompare(x.data)).slice(0, 8);
  const audiencias = b.audiencias.filter((a) => a.data >= h).sort((x, y) => x.data.localeCompare(y.data));
  const meus = m.regs.filter((r) => r.usuarioId === b.config.usuarioAtualId).length;

  return (
    <>
      <Topo titulo="Painel" subtitulo={`${b.config.nomeEscritorio} · ${formatar(h)}`}>
        <Segmentos valor={periodo} aoMudar={setPeriodo} opcoes={[['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias']]} />
        <button className="btn primario" onClick={() => setRegistrar(true)}>+ Registrar movimentação</button>
      </Topo>

      <h2>Atenção agora</h2>
      <div className="grade g4 manter mt">
        <Stat rotulo="Prazos vencendo hoje" valor={prazosHoje.length} detalhe={vencidos.length ? `${vencidos.length} vencido(s) sem baixa` : 'nenhum vencido'} alerta={prazosHoje.length + vencidos.length > 0} />
        <Stat rotulo="Intimações sem tratar" valor={intimacoesNovas.length} detalhe={<Link to="/controladoria">abrir caixa</Link>} alerta={intimacoesNovas.length > 0} />
        <Stat rotulo="Audiências sem contato (7 dias)" valor={audSemContato.length} alerta={audSemContato.length > 0} />
        <Stat rotulo="Honorários a receber" valor={<span style={{ fontSize: '1.25rem' }}>{moeda(aReceber)}</span>} detalhe={<Link to="/financeiro">financeiro</Link>} />
      </div>

      <Carteira b={b} />

      <div className="secao">
        <h2>Entrada e produção</h2>
        <div className="grade g4 manter mt">
          <Stat rotulo="Entradas pelo WhatsApp" valor={m.entradasWhats} detalhe={`${m.entradasTotal} em todos os canais`} />
          <Stat rotulo="Processos protocolados" valor={m.protocolos} />
          <Stat rotulo="Audiências marcadas" valor={m.audiencias} />
          <Stat rotulo="Recursos interpostos" valor={m.recursos} />
          <Stat rotulo="Dilações de prazo" valor={m.dilacoes} />
          <Stat rotulo="Exigências cumpridas" valor={m.exigencias} />
          <Stat rotulo="Minha produção no período" valor={meus} detalhe={nomeUsuario(b, b.config.usuarioAtualId)} />
        </div>
      </div>

      <div className="secao">
        <h2>Resultados</h2>
        <div className="grade g4 manter mt">
          <Stat rotulo="Despachos" valor={m.despachos} detalhe={`${m.despachosFav} favorável(is)`} />
          <Stat rotulo="Sentenças" valor={m.sentencas} detalhe={`${m.procedentes} proc. · ${m.parciais} parc. · ${m.improcedentes} improc.`} />
          <Stat rotulo="Taxa de procedência" valor={m.taxa === null ? '—' : `${m.taxa}%`} detalhe="procedentes + parciais" />
        </div>
      </div>

      <div className="secao">
        <h2>Audiências</h2>
        <div className="cartao mt tabela-wrap">
          {audiencias.length === 0 ? <Vazio>Nenhuma audiência futura.</Vazio> : (
            <table>
              <thead><tr><th>Data</th><th>Cliente</th><th>Testemunhas</th><th>Cliente contatado</th><th>Testemunhas confirmadas</th></tr></thead>
              <tbody>
                {audiencias.map((a) => {
                  const p = b.processos.find((x) => x.id === a.processoId);
                  const faltaContato = !a.clienteContatado || !a.testemunhasConfirmadas;
                  const vermelho = faltaContato && diasEntre(h, a.data) <= 7;
                  return (
                    <tr key={a.id} className={vermelho ? 'linha-vermelha' : ''}>
                      <td className="num">{formatar(a.data)} {a.hora}<div className="mudo">{a.local}</div></td>
                      <td>{p ? <Link to={`/processos/${p.id}`}>{nomeCliente(b, p.clienteId)}</Link> : '—'}</td>
                      <td>{a.testemunhas.length ? a.testemunhas.map((t) => <div key={t.nome}>{t.nome} <span className="mudo num">{t.telefone}</span></div>) : <span className="mudo">sem testemunhas</span>}</td>
                      <td><input type="checkbox" checked={a.clienteContatado} onChange={(e) => alterar((db) => { db.audiencias.find((x) => x.id === a.id)!.clienteContatado = e.target.checked; })} aria-label="Cliente contatado" /></td>
                      <td><input type="checkbox" checked={a.testemunhasConfirmadas} onChange={(e) => alterar((db) => { db.audiencias.find((x) => x.id === a.id)!.testemunhasConfirmadas = e.target.checked; })} aria-label="Testemunhas confirmadas" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grade g3 secao">
        <div className="cartao">
          <h3>Últimas movimentações</h3>
          <ul className="lista">
            {ultimas.map((r) => (
              <li key={r.id}>
                <span>
                  {ROTULO_REGISTRO[r.tipo]}
                  {r.canal ? ` · ${ROTULO_CANAL[r.canal]}` : ''}
                  {r.resultado ? ` · ${r.resultado}` : ''}
                  <div className="mudo">{nomeUsuario(b, r.usuarioId)}</div>
                </span>
                <span className="num mudo">{formatar(r.data)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="cartao">
          <h3>Próximos prazos</h3>
          {proximosPrazos.length === 0 ? <Vazio>Sem prazos pendentes.</Vazio> : (
            <ul className="lista">
              {proximosPrazos.map((c) => (
                <li key={c.id}>
                  <span>{c.titulo}<div className="mudo">{nomeUsuario(b, c.responsavelId)}</div></span>
                  <span className={`etiqueta ${c.data === h ? 'vermelho' : 'violeta'} num`}>{formatar(c.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cartao">
          <h3>Carga da equipe <TagDiamante /></h3>
          <SoDiamante b={b} recurso="Carga da equipe">
            <CargaEquipe b={b} />
          </SoDiamante>
        </div>
      </div>

      {registrar && <RegistrarMovimentacao aoFechar={() => setRegistrar(false)} />}
    </>
  );
}

function CargaEquipe({ b }: { b: Banco }) {
  if (!ehDiamante(b)) return null;
  const linhas = b.usuarios
    .filter((u) => u.papel !== 'cliente')
    .map((u) => {
      const abertas = b.tarefas.filter((t) => t.responsavelId === u.id && t.coluna !== 'concluido');
      return { u, tarefas: abertas.length, pontos: abertas.reduce((s, t) => s + t.pontos, 0), prazos: b.compromissos.filter((c) => c.responsavelId === u.id && c.status === 'pendente').length };
    });
  const max = Math.max(1, ...linhas.map((l) => l.pontos));
  return (
    <ul className="lista">
      {linhas.map((l) => (
        <li key={l.u.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <div className="flex entre"><span>{l.u.nome}</span><span className="num mudo">{l.pontos} pts · {l.prazos} prazos</span></div>
          <div className="barra"><span style={{ width: `${(l.pontos / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
