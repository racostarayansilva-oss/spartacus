// "Valores e provisionamento" (como no Legis) + dados do tribunal vindos do DataJud.
import { useState } from 'react';
import { alterar, Processo, SituacaoRpv } from '../store';
import { formatar } from '../lib/datas';
import { moeda } from '../lib/honorarios';
import { ROTULO_SITUACAO_RPV } from '../lib/execucoes';

const ROTULO_RISCO = { provavel: 'Perda provável', possivel: 'Perda possível', remota: 'Perda remota' } as const;

export function ValoresProcesso({ p }: { p: Processo }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({
    valor: p.valor || 0, provisionar: !!p.provisionamento?.provisionar, valorProv: p.provisionamento?.valor || 0, risco: p.provisionamento?.risco || 'possivel',
    rpvValor: p.rpv?.valor || 0, rpvSituacao: (p.rpv?.situacao || '') as SituacaoRpv | '', rpvPasso: p.rpv?.proximoPasso || '',
  });
  const dj = p.dadosJudiciais;
  const rpv = p.rpv;

  const salvar = () => {
    alterar((db) => {
      const x = db.processos.find((y) => y.id === p.id);
      if (!x) return;
      x.valor = Number(f.valor) || 0;
      x.provisionamento = f.provisionar ? { provisionar: true, valor: Number(f.valorProv) || undefined, risco: f.risco } : { provisionar: false };
      if (f.rpvSituacao) {
        const mudou = !x.rpv || x.rpv.situacao !== f.rpvSituacao || x.rpv.valor !== (Number(f.rpvValor) || 0) || (x.rpv.proximoPasso || '') !== f.rpvPasso.trim();
        if (mudou) x.rpv = { ...x.rpv, valor: Number(f.rpvValor) || 0, situacao: f.rpvSituacao, proximoPasso: f.rpvPasso.trim() || undefined, atualizadoEm: new Date().toISOString() };
      } else delete x.rpv;
    });
    setEditando(false);
  };

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <h3>Valores e provisionamento</h3>
        {!editando && <button className="btn pequeno fantasma" onClick={() => setEditando(true)}>Editar</button>}
      </div>
      {!editando ? (
        <dl className="ficha-dados" style={{ marginTop: 4, paddingTop: 0, borderTop: 0 }}>
          <div><dt>Valor da causa</dt><dd className="num">{p.valor ? moeda(p.valor) : <span className="mudo">Não informado</span>}</dd></div>
          <div>
            <dt>Provisionamento da ação</dt>
            <dd>{p.provisionamento?.provisionar ? <>Sim · {ROTULO_RISCO[p.provisionamento.risco || 'possivel']}{p.provisionamento.valor ? <span className="num"> · {moeda(p.provisionamento.valor)}</span> : ''}</> : 'Não'}</dd>
          </div>
          {rpv && (
            <>
              <div><dt>Valor da RPV</dt><dd className="num">{rpv.valor ? moeda(rpv.valor) : '—'}</dd></div>
              <div><dt>Situação da RPV</dt><dd>{ROTULO_SITUACAO_RPV[rpv.situacao]}</dd></div>
              {rpv.movimentacao && <div style={{ gridColumn: '1 / -1' }}><dt>Movimentação</dt><dd>{rpv.movimentacao}{rpv.ultimaMovimentacao ? <span className="mudo num"> · {formatar(rpv.ultimaMovimentacao)}</span> : ''}</dd></div>}
              {rpv.proximoPasso && <div style={{ gridColumn: '1 / -1' }}><dt>O que fazer</dt><dd>{rpv.proximoPasso}</dd></div>}
            </>
          )}
        </dl>
      ) : (
        <div className="grade" style={{ gap: 10 }}>
          <div className="linha-campos">
            <label className="campo">Valor da causa (R$)<input type="number" min={0} step="0.01" value={f.valor || ''} onChange={(e) => setF({ ...f, valor: Number(e.target.value) })} autoFocus /></label>
            <label className="campo">Provisionar a ação?
              <select value={f.provisionar ? 'sim' : 'nao'} onChange={(e) => setF({ ...f, provisionar: e.target.value === 'sim' })}>
                <option value="nao">Não</option><option value="sim">Sim</option>
              </select>
            </label>
          </div>
          {f.provisionar && (
            <div className="linha-campos">
              <label className="campo">Risco
                <select value={f.risco} onChange={(e) => setF({ ...f, risco: e.target.value as typeof f.risco })}>
                  {Object.entries(ROTULO_RISCO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </label>
              <label className="campo">Valor provisionado (R$)<input type="number" min={0} step="0.01" value={f.valorProv || ''} onChange={(e) => setF({ ...f, valorProv: Number(e.target.value) })} /></label>
            </div>
          )}
          <div className="linha-campos">
            <label className="campo">Situação da RPV
              <select value={f.rpvSituacao} onChange={(e) => setF({ ...f, rpvSituacao: e.target.value as SituacaoRpv | '' })}>
                <option value="">Sem RPV</option>
                {Object.entries(ROTULO_SITUACAO_RPV).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            {f.rpvSituacao && <label className="campo">Valor da RPV (R$)<input type="number" min={0} step="0.01" value={f.rpvValor || ''} onChange={(e) => setF({ ...f, rpvValor: Number(e.target.value) })} /></label>}
          </div>
          {f.rpvSituacao && <label className="campo">O que fazer<input value={f.rpvPasso} onChange={(e) => setF({ ...f, rpvPasso: e.target.value })} /></label>}
          <div className="flex"><button className="btn primario pequeno" onClick={salvar}>Salvar</button><button className="btn pequeno" onClick={() => setEditando(false)}>Cancelar</button></div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--borda)', marginTop: 14, paddingTop: 12 }}>
        <div className="mudo" style={{ fontSize: 12, marginBottom: 6 }}>Dados do tribunal{dj ? ` · DataJud em ${formatar(dj.atualizadoEm.slice(0, 10))}` : ''}</div>
        {dj ? (
          <dl className="ficha-dados" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
            {dj.classe && <div><dt>Classe</dt><dd>{dj.classe}</dd></div>}
            {dj.orgao && <div><dt>Órgão julgador</dt><dd>{dj.orgao}</dd></div>}
            {dj.ajuizamento && <div><dt>Ajuizamento</dt><dd className="num">{formatar(dj.ajuizamento.slice(0, 10))}</dd></div>}
            {dj.grau && <div><dt>Grau</dt><dd>{dj.grau}</dd></div>}
            {!!dj.assuntos?.length && <div style={{ gridColumn: '1 / -1' }}><dt>Assuntos</dt><dd className="flex" style={{ gap: 4 }}>{dj.assuntos.map((a) => <span key={a} className="etiqueta">{a}</span>)}</dd></div>}
          </dl>
        ) : (
          <p className="mudo" style={{ margin: 0, fontSize: 13 }}>Use “Atualizar pelo DataJud” em Movimentações para trazer classe, assuntos, órgão e data de ajuizamento. O valor da causa só vem quando o tribunal o envia ao DataJud; senão, informe em Editar.</p>
        )}
      </div>
    </div>
  );
}
