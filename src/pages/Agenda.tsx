import { useState } from 'react';
import { alterar, Compromisso, nomeUsuario, novoId, useBanco } from '../store';
import { PRAZOS_COMUNS, prazoCorrido, prazoDiasUteis, prazoJudicial, ResultadoPrazo, situacaoPrazo } from '../lib/prazos';
import { formatar, formatarComSemana, hoje } from '../lib/datas';
import { Campo, Segmentos, Topo, Vazio } from '../components/ui';
import { opcoesCalendario } from './Controladoria';

const ORIGEM: Record<Compromisso['origem'], string> = { judicial: 'Judicial', inss: 'INSS', audiencia: 'Audiência', interno: 'Interno' };
const COR_ORIGEM: Record<Compromisso['origem'], string> = { judicial: 'violeta', inss: 'ambar', audiencia: 'vermelho', interno: '' };

export default function Agenda() {
  const b = useBanco();
  const [base, setBase] = useState<'dje' | 'ciencia' | 'corrido'>('dje');
  const [data, setData] = useState(hoje());
  const [dias, setDias] = useState(15);
  const [filtro, setFiltro] = useState<'pendente' | 'concluido'>('pendente');
  const [novo, setNovo] = useState<Omit<Compromisso, 'id' | 'status'>>({ titulo: '', data: hoje(), origem: 'interno', responsavelId: b.config.usuarioAtualId, processoId: null });

  let res: ResultadoPrazo | null = null;
  let erro = '';
  try {
    const op = opcoesCalendario(b);
    res = base === 'dje' ? prazoJudicial(data, dias, op) : base === 'ciencia' ? prazoDiasUteis(data, dias, op) : prazoCorrido(data, dias, op);
  } catch (e: any) {
    erro = e.message;
  }

  const lista = b.compromissos.filter((c) => c.status === filtro).sort((x, y) => (filtro === 'pendente' ? x.data.localeCompare(y.data) : y.data.localeCompare(x.data)));
  const h = hoje();

  const salvarNovo = (titulo?: string, dataFatal?: string, origem?: Compromisso['origem'], baseLegal?: string) => {
    const t = titulo ?? novo.titulo;
    if (!t.trim()) return;
    alterar((db) => {
      db.compromissos.push({ ...novo, id: novoId(), titulo: t, data: dataFatal ?? novo.data, origem: origem ?? novo.origem, status: 'pendente', base: baseLegal });
    });
    setNovo({ ...novo, titulo: '' });
  };

  return (
    <>
      <Topo titulo="Prazos e agenda" subtitulo="Calculadora em dias úteis e compromissos com origem, responsável e status." />
      <div className="grade g2">
        <div className="cartao">
          <h3>Calculadora de prazo</h3>
          <div className="flex" style={{ marginBottom: 10 }}>
            {PRAZOS_COMUNS.map((p) => (
              <button key={p.nome} className="btn pequeno" title={p.base} onClick={() => { setDias(p.dias); setBase(p.modo === 'corridos' ? 'corrido' : base === 'corrido' ? 'dje' : base); }}>
                {p.nome} ({p.dias})
              </button>
            ))}
          </div>
          <Segmentos valor={base} aoMudar={setBase} opcoes={[['dje', 'Disponibilização no DJe'], ['ciencia', 'Intimação/ciência'], ['corrido', 'Corridos (INSS)']]} />
          <div className="linha-campos mt">
            <Campo rotulo={base === 'dje' ? 'Data da disponibilização' : 'Data da ciência'}><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo rotulo={base === 'corrido' ? 'Dias corridos' : 'Dias úteis'}><input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} /></Campo>
          </div>
          {erro && <div className="erro mt">{erro}</div>}
          {res && (
            <div className="mt">
              {res.publicacao && <div>Publicação: <span className="num">{formatarComSemana(res.publicacao)}</span></div>}
              <div>Início da contagem: <span className="num">{formatarComSemana(res.inicio)}</span></div>
              <div style={{ fontSize: '1.15rem', marginTop: 4 }}>Data fatal: <strong className="num">{formatarComSemana(res.fatal)}</strong></div>
              {res.pulados.length > 0 && (
                <details className="mt">
                  <summary className="mudo">{res.pulados.length} dia(s) não contado(s)</summary>
                  <ul className="lista">
                    {res.pulados.filter((p) => !['sábado', 'domingo'].includes(p.motivo)).map((p) => <li key={p.data}><span className="num">{formatar(p.data)}</span><span className="mudo">{p.motivo}</span></li>)}
                  </ul>
                  <p className="mudo">Fins de semana omitidos da lista.</p>
                </details>
              )}
              {res.avisos.map((a) => <div key={a} className="aviso mt">{a}</div>)}
              <div className="flex mt">
                <input placeholder="Título do prazo para agendar" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} style={{ flex: 1 }} />
                <button className="btn primario" onClick={() => salvarNovo(undefined, res!.fatal, base === 'corrido' ? 'inss' : 'judicial', `${dias} dias ${res!.modo === 'uteis' ? 'úteis' : 'corridos'} a partir de ${formatar(data)}`)}>Agendar data fatal</button>
              </div>
            </div>
          )}
        </div>

        <div className="cartao">
          <h3>Novo compromisso</h3>
          <div className="grade" style={{ gap: 10 }}>
            <Campo rotulo="Título"><input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></Campo>
            <div className="linha-campos">
              <Campo rotulo="Data"><input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} /></Campo>
              <Campo rotulo="Origem">
                <select value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value as Compromisso['origem'] })}>
                  {Object.entries(ORIGEM).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Responsável">
                <select value={novo.responsavelId} onChange={(e) => setNovo({ ...novo, responsavelId: e.target.value })}>
                  {b.usuarios.filter((u) => u.papel !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Processo (opcional)">
              <select value={novo.processoId || ''} onChange={(e) => setNovo({ ...novo, processoId: e.target.value || null })}>
                <option value="">—</option>
                {b.processos.map((p) => <option key={p.id} value={p.id}>{p.numero}</option>)}
              </select>
            </Campo>
            <div><button className="btn primario" onClick={() => salvarNovo()}>Adicionar</button></div>
            <p className="mudo" style={{ margin: 0 }}>Exigência do INSS: use “Corridos (INSS)” com 30 dias. Pela IN 212/2026, exigência sem resposta em 30 dias pode encerrar o pedido sem análise de mérito.</p>
          </div>
        </div>
      </div>

      <div className="cartao secao tabela-wrap">
        <div className="cartao-cab">
          <h3>Compromissos</h3>
          <Segmentos valor={filtro} aoMudar={setFiltro} opcoes={[['pendente', 'Pendentes'], ['concluido', 'Concluídos']]} />
        </div>
        {lista.length === 0 ? <Vazio>Nada aqui.</Vazio> : (
          <table>
            <thead><tr><th>Data</th><th>Compromisso</th><th>Origem</th><th>Responsável</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const s = situacaoPrazo(c.data, h);
                return (
                  <tr key={c.id} className={c.status === 'pendente' && (s === 'vencido' || s === 'hoje') ? 'linha-vermelha' : ''}>
                    <td className="num">{formatarComSemana(c.data)}{c.status === 'pendente' && s === 'vencido' && <div className="etiqueta vermelho">vencido</div>}</td>
                    <td>{c.titulo}{c.base && <div className="mudo">{c.base}</div>}</td>
                    <td><span className={`etiqueta ${COR_ORIGEM[c.origem]}`}>{ORIGEM[c.origem]}</span></td>
                    <td>{nomeUsuario(b, c.responsavelId)}</td>
                    <td>
                      <button className="btn pequeno" onClick={() => alterar((db) => { const x = db.compromissos.find((y) => y.id === c.id)!; x.status = x.status === 'pendente' ? 'concluido' : 'pendente'; })}>
                        {c.status === 'pendente' ? 'Concluir' : 'Reabrir'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
