import { useState } from 'react';
import { alterar, Lancamento, nomeCliente, novoId, useBanco } from '../store';
import { honorariosSobreRpv, moeda } from '../lib/honorarios';
import { formatar, hoje, somarDias } from '../lib/datas';
import { Campo, Segmentos, SoDiamante, Stat, TagDiamante, Topo, Vazio } from '../components/ui';
import { RpvsProcessos } from '../components/RpvsProcessos';

export default function Financeiro() {
  const b = useBanco();
  const [filtro, setFiltro] = useState<'aberto' | 'pago' | 'todos'>('aberto');
  const [novo, setNovo] = useState<Omit<Lancamento, 'id' | 'pago'>>({ tipo: 'receita', descricao: '', valor: 0, vencimento: hoje(), processoId: null, categoria: '' });

  const receitas = b.lancamentos.filter((l) => l.tipo === 'receita');
  const despesas = b.lancamentos.filter((l) => l.tipo === 'despesa');
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);
  const aReceber = soma(receitas.filter((l) => !l.pago));
  const recebido = soma(receitas.filter((l) => l.pago));
  const aPagar = soma(despesas.filter((l) => !l.pago));
  const pago = soma(despesas.filter((l) => l.pago));
  const saldoPrevisto = recebido + aReceber - pago - aPagar;

  const lista = b.lancamentos
    .filter((l) => filtro === 'todos' || (filtro === 'pago' ? l.pago : !l.pago))
    .sort((x, y) => x.vencimento.localeCompare(y.vencimento));

  const excluir = (l: Lancamento) => {
    if (!confirm(`Excluir o lançamento "${l.descricao}" (${moeda(l.valor)})?`)) return;
    alterar((db) => {
      db.lancamentos = db.lancamentos.filter((x) => x.id !== l.id);
      for (const p of db.processos) if (p.rpv?.lancamentoId === l.id) delete p.rpv.lancamentoId;
    });
  };

  const adicionar = () => {
    if (!novo.descricao.trim() || !(novo.valor > 0)) return;
    alterar((db) => { db.lancamentos.push({ ...novo, id: novoId(), pago: false }); });
    setNovo({ ...novo, descricao: '', valor: 0 });
  };

  return (
    <>
      <Topo titulo="Financeiro" subtitulo="Receitas, despesas, valores a receber, recebidos e saldo previsto." />
      <div className="grade g4 manter">
        <Stat rotulo="A receber" valor={<span style={{ fontSize: '1.3rem' }}>{moeda(aReceber)}</span>} />
        <Stat rotulo="Recebido" valor={<span style={{ fontSize: '1.3rem' }}>{moeda(recebido)}</span>} />
        <Stat rotulo="Despesas (pagas + a pagar)" valor={<span style={{ fontSize: '1.3rem' }}>{moeda(pago + aPagar)}</span>} detalhe={`${moeda(aPagar)} a pagar`} />
        <Stat rotulo="Saldo previsto" valor={<span style={{ fontSize: '1.3rem' }}>{moeda(saldoPrevisto)}</span>} alerta={saldoPrevisto < 0} />
      </div>

      <div className="grade g2 secao">
        <div className="cartao tabela-wrap">
          <div className="cartao-cab">
            <h3>Lançamentos</h3>
            <Segmentos valor={filtro} aoMudar={setFiltro} opcoes={[['aberto', 'Em aberto'], ['pago', 'Pagos'], ['todos', 'Todos']]} />
          </div>
          {lista.length === 0 ? <Vazio>Nada aqui.</Vazio> : (
            <table>
              <thead><tr><th>Vencimento</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className={!l.pago && l.vencimento < hoje() ? 'linha-vermelha' : ''}>
                    <td className="num">{formatar(l.vencimento)}</td>
                    <td>{l.descricao}<div className="mudo">{l.categoria}{l.processoId ? ` · ${nomeCliente(b, b.processos.find((p) => p.id === l.processoId)?.clienteId)}` : ''}</div></td>
                    <td className="num" style={{ color: l.tipo === 'despesa' ? 'var(--vermelho)' : 'var(--verde)', whiteSpace: 'nowrap' }}>{l.tipo === 'despesa' ? '−' : '+'}{moeda(l.valor)}</td>
                    <td>
                      <button className="btn pequeno" onClick={() => alterar((db) => { const x = db.lancamentos.find((y) => y.id === l.id)!; x.pago = !x.pago; x.pagoEm = x.pago ? hoje() : null; })}>
                        {l.pago ? 'Desfazer' : l.tipo === 'receita' ? 'Recebido' : 'Pago'}
                      </button>
                      {' '}<button className="btn pequeno fantasma" onClick={() => excluir(l)} aria-label={`Excluir ${l.descricao}`}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="linha-campos mt" style={{ alignItems: 'end' }}>
            <Campo rotulo="Tipo"><select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as Lancamento['tipo'] })}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></Campo>
            <Campo rotulo="Descrição"><input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></Campo>
            <Campo rotulo="Valor (R$)"><input type="number" min={0} step="0.01" value={novo.valor || ''} onChange={(e) => setNovo({ ...novo, valor: Number(e.target.value) })} /></Campo>
            <Campo rotulo="Vencimento"><input type="date" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} /></Campo>
            <button className="btn" onClick={adicionar}>Adicionar</button>
          </div>
        </div>

        <div className="cartao">
          <h3>Honorários sobre RPV <TagDiamante /></h3>
          <SoDiamante b={b} recurso="Calculadora de honorários sobre RPV">
            <CalculadoraRpv />
          </SoDiamante>
        </div>
      </div>

      <RpvsProcessos />
    </>
  );
}

function CalculadoraRpv() {
  const b = useBanco();
  const [valor, setValor] = useState(0);
  const [perc, setPerc] = useState(30);
  const [proc, setProc] = useState('');
  let r = null;
  let erro = '';
  try { r = honorariosSobreRpv(valor || 0, perc); } catch (e: any) { erro = e.message; }

  const lancar = () => {
    if (!r || !r.honorarios) return;
    const p = b.processos.find((x) => x.id === proc);
    alterar((db) => {
      db.lancamentos.push({
        id: novoId(), tipo: 'receita', descricao: `Honorários RPV ${perc}%${p ? ' — ' + nomeCliente(db, p.clienteId) : ''}`,
        valor: r!.honorarios, vencimento: somarDias(hoje(), 60), pago: false, processoId: proc || null, categoria: 'Honorários RPV',
      });
    });
  };

  return (
    <div className="grade" style={{ gap: 10 }}>
      <div className="linha-campos">
        <Campo rotulo="Valor da RPV (R$)"><input type="number" min={0} step="0.01" value={valor || ''} onChange={(e) => setValor(Number(e.target.value))} /></Campo>
        <Campo rotulo="Percentual contratual (%)"><input type="number" min={0} max={100} step="0.5" value={perc} onChange={(e) => setPerc(Number(e.target.value))} /></Campo>
      </div>
      {erro && <div className="erro">{erro}</div>}
      {r && (
        <ul className="lista">
          <li><span>Valor da RPV</span><span className="num">{moeda(r.valorRpv)}</span></li>
          <li><span>Honorários ({r.percentual}%)</span><strong className="num">{moeda(r.honorarios)}</strong></li>
          <li><span>Líquido do cliente</span><strong className="num">{moeda(r.liquidoCliente)}</strong></li>
        </ul>
      )}
      <Campo rotulo="Processo (opcional)">
        <select value={proc} onChange={(e) => setProc(e.target.value)}>
          <option value="">—</option>
          {b.processos.map((p) => <option key={p.id} value={p.id}>{p.numero} — {nomeCliente(b, p.clienteId)}</option>)}
        </select>
      </Campo>
      <div><button className="btn primario" onClick={lancar} disabled={!r?.honorarios}>Lançar honorários a receber</button></div>
      <p className="mudo" style={{ margin: 0 }}>RPV no JEF é paga em até 60 dias da requisição (Lei 10.259/01, art. 17); o vencimento é sugerido com essa data.</p>
    </div>
  );
}
