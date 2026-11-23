// Financeiro → RPVs dos processos: percentual de honorários, lançamento a receber e remoção da RPV.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Banco, nomeCliente, novoId, Processo, SituacaoRpv, useBanco } from '../store';
import { honorariosSobreRpv, moeda } from '../lib/honorarios';
import { hoje, somarDias } from '../lib/datas';
import { ROTULO_SITUACAO_RPV } from '../lib/execucoes';
import { Segmentos, Vazio } from './ui';

export const PERCENTUAL_PADRAO = 30;
const percentualDe = (p: Processo) => p.rpv?.percentual ?? PERCENTUAL_PADRAO;
const calculo = (p: Processo) => honorariosSobreRpv(p.rpv?.valor || 0, percentualDe(p));

function lancarHonorarios(db: Banco, processoId: string) {
  const p = db.processos.find((x) => x.id === processoId);
  if (!p?.rpv || (p.rpv.lancamentoId && db.lancamentos.some((l) => l.id === p.rpv!.lancamentoId))) return;
  const r = honorariosSobreRpv(p.rpv.valor, p.rpv.percentual ?? PERCENTUAL_PADRAO);
  if (!r.honorarios) return;
  const id = novoId();
  db.lancamentos.push({
    id, tipo: 'receita', descricao: `Honorários RPV ${r.percentual}% — ${nomeCliente(db, p.clienteId)}`,
    valor: r.honorarios, vencimento: somarDias(hoje(), 60), pago: false, processoId: p.id, categoria: 'Honorários RPV',
  });
  p.rpv.lancamentoId = id;
}

export function RpvsProcessos() {
  const b = useBanco();
  const [filtro, setFiltro] = useState<'andamento' | 'pagas' | 'todas'>('andamento');
  const todas = b.processos.filter((p) => p.rpv);
  const lista = todas
    .filter((p) => filtro === 'todas' || (filtro === 'pagas' ? p.rpv!.situacao === 'paga' : p.rpv!.situacao !== 'paga'))
    .sort((x, y) => nomeCliente(b, x.clienteId).localeCompare(nomeCliente(b, y.clienteId)));
  const lancado = (p: Processo) => !!p.rpv?.lancamentoId && b.lancamentos.some((l) => l.id === p.rpv!.lancamentoId);
  const tot = lista.reduce((s, p) => { const r = calculo(p); return { bruto: s.bruto + r.valorRpv, hon: s.hon + r.honorarios, liq: s.liq + r.liquidoCliente }; }, { bruto: 0, hon: 0, liq: 0 });
  const faltaLancar = lista.filter((p) => !lancado(p) && p.rpv!.situacao !== 'paga');

  const mudar = (id: string, f: (p: Processo) => void) => alterar((db) => { const p = db.processos.find((x) => x.id === id); if (p?.rpv) f(p); });
  const remover = (p: Processo) => {
    const l = lancado(p) ? b.lancamentos.find((x) => x.id === p.rpv!.lancamentoId) : undefined;
    const aviso = l && !l.pago ? '\nO lançamento de honorários a receber ligado a ela também será apagado.' : '';
    if (!confirm(`Remover a RPV de ${nomeCliente(b, p.clienteId)} (${moeda(p.rpv!.valor)})?${aviso}`)) return;
    alterar((db) => {
      const x = db.processos.find((y) => y.id === p.id);
      if (!x?.rpv) return;
      const lid = x.rpv.lancamentoId;
      if (lid) db.lancamentos = db.lancamentos.filter((y) => y.id !== lid || y.pago);
      delete x.rpv;
    });
  };

  return (
    <div className="cartao tabela-wrap secao">
      <div className="cartao-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>RPVs dos processos</h3>
          <div className="mudo">Percentual padrão de honorários: {PERCENTUAL_PADRAO}%. Ajuste em cada linha (salário-maternidade: 50%).</div>
        </div>
        <div className="flex">
          <Segmentos valor={filtro} aoMudar={setFiltro} opcoes={[['andamento', 'Em andamento'], ['pagas', 'Pagas'], ['todas', 'Todas']]} />
          {faltaLancar.length > 0 && (
            <button className="btn pequeno" onClick={() => alterar((db) => faltaLancar.forEach((p) => lancarHonorarios(db, p.id)))}>
              Lançar honorários de {faltaLancar.length}
            </button>
          )}
        </div>
      </div>
      {lista.length === 0 ? <Vazio>Nenhuma RPV nesta lista. A RPV é cadastrada na ficha do processo, em Valores e provisionamento.</Vazio> : (
        <table>
          <thead>
            <tr><th>Cliente</th><th>Situação</th><th className="num">RPV</th><th className="num">%</th><th className="num">Honorários</th><th className="num">Líquido cliente</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const r = calculo(p);
              return (
                <tr key={p.id}>
                  <td><Link to={`/processos/${p.id}`}>{nomeCliente(b, p.clienteId)}</Link><div className="mudo mono" style={{ fontSize: 12 }}>{p.numero}</div></td>
                  <td>
                    <select value={p.rpv!.situacao} onChange={(e) => mudar(p.id, (x) => { x.rpv!.situacao = e.target.value as SituacaoRpv; x.rpv!.atualizadoEm = new Date().toISOString(); })} aria-label="Situação da RPV">
                      {Object.entries(ROTULO_SITUACAO_RPV).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </td>
                  <td className="num">{moeda(r.valorRpv)}</td>
                  <td className="num">
                    <input type="number" min={0} max={100} step="0.5" style={{ width: 64 }} value={percentualDe(p)} disabled={lancado(p)}
                      title={lancado(p) ? 'Honorários já lançados: apague o lançamento para mudar o percentual' : ''}
                      onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 100) mudar(p.id, (x) => { x.rpv!.percentual = v; }); }}
                      aria-label={`Percentual de honorários de ${nomeCliente(b, p.clienteId)}`} />
                  </td>
                  <td className="num"><b>{moeda(r.honorarios)}</b></td>
                  <td className="num">{moeda(r.liquidoCliente)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {lancado(p)
                      ? <span className="mudo" style={{ fontSize: 12 }}>Lançado</span>
                      : <button className="btn pequeno" onClick={() => alterar((db) => lancarHonorarios(db, p.id))} disabled={!r.honorarios}>Lançar</button>}
                    {' '}<button className="btn pequeno fantasma" onClick={() => remover(p)}>Remover</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><th>Total ({lista.length})</th><th></th><th className="num">{moeda(tot.bruto)}</th><th></th><th className="num">{moeda(tot.hon)}</th><th className="num">{moeda(tot.liq)}</th><th></th></tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
