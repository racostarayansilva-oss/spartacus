import { useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Banco, Intimacao, nomeCliente, nomeUsuario, novoId, useBanco } from '../store';
import { ROTULO_SITUACAO, tarefaDaIntimacao } from '../lib/tarefas';
import { prazoJudicial, situacaoPrazo } from '../lib/prazos';
import { formatar, formatarComSemana, hoje, somarDias } from '../lib/datas';
import { cnjValido, formatarCnj } from '../lib/cnj';
import { api } from '../api';
import { idIntimacaoDjen, intimacaoDaComunicacao, sugerirDias } from '../lib/intimacoes';
import { Campo, Segmentos, Topo, Vazio } from '../components/ui';
import { MonitorAutomatico } from '../components/MonitorAutomatico';

export function opcoesCalendario(b: Banco) {
  // Estados do escritório = UFs das OABs cadastradas. Feriados estaduais embutidos: MA e PA; os demais estados
  // entram como feriados cadastrados (Prazos e agenda → feriados) na implantação.
  const ufs = [...new Set((b.config.oabs || []).map((o) => o.uf.toUpperCase()))];
  return { ufs, extras: b.config.feriadosExtras };
}

export default function Controladoria() {
  const b = useBanco();
  const [filtro, setFiltro] = useState<'nova' | 'tratada' | 'todas'>('nova');
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState({ disponibilizacao: hoje(), tribunal: '', processoNumero: '', texto: '' });

  const lista = b.intimacoes
    .filter((i) => filtro === 'todas' || i.status === filtro)
    .sort((x, y) => y.disponibilizacao.localeCompare(x.disponibilizacao));

  const buscarDjen = async () => {
    setBuscando(true);
    setMsg('');
    let novas = 0;
    try {
      for (const oab of b.config.oabs) {
        const itens = await api<any[]>(`publicacoes?oab=${oab.numero}&uf=${oab.uf}&inicio=${somarDias(hoje(), -7)}&fim=${hoje()}`);
        alterar((db) => {
          for (const it of itens) {
            if (db.intimacoes.some((x) => x.id === idIntimacaoDjen(it))) continue;
            db.intimacoes.push(intimacaoDaComunicacao(it));
            novas++;
          }
        });
      }
      setMsg(novas ? `${novas} intimação(ões) nova(s) trazida(s) do DJEN.` : 'Nenhuma intimação nova nos últimos 7 dias.');
    } catch (e: any) {
      setMsg('Não foi possível consultar o DJEN: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const adicionarManual = () => {
    if (!manual.texto.trim()) return;
    alterar((db) => {
      db.intimacoes.push({ id: novoId(), ...manual, processoNumero: formatarCnj(manual.processoNumero), dias: sugerirDias(manual.texto), status: 'nova', origem: 'manual' });
    });
    setManual({ disponibilizacao: hoje(), tribunal: '', processoNumero: '', texto: '' });
  };

  return (
    <>
      <Topo titulo="Controladoria" subtitulo="Caixa de intimações: cada publicação vira um prazo com responsável e data fatal.">
        <Segmentos valor={filtro} aoMudar={setFiltro} opcoes={[['nova', 'Sem tratar'], ['tratada', 'Tratadas'], ['todas', 'Todas']]} />
        <button className="btn primario" onClick={buscarDjen} disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar no DJEN (OAB)'}</button>
      </Topo>
      {msg && <div className="aviso" style={{ marginBottom: 12 }}>{msg}</div>}
      <MonitorAutomatico />
      <p className="mudo" style={{ marginTop: 0 }}>
        Regra: publicação no 1º dia útil após a disponibilização no DJe; o prazo começa no dia útil seguinte (CPC, arts. 219 e 224); pula fins de semana, feriados e o recesso de 20/12 a 20/01 (art. 220). Feriados locais do MA e do PA aparecem como “conferir”.
      </p>

      <div className="grade" style={{ gap: 12 }}>
        {lista.length === 0 && <div className="cartao"><Vazio>Nenhuma intimação nesta lista.</Vazio></div>}
        {lista.map((i) => <CartaoIntimacao key={i.id} b={b} i={i} />)}
      </div>

      <div className="cartao secao">
        <h3>Lançar intimação manualmente</h3>
        <div className="linha-campos">
          <Campo rotulo="Disponibilização no DJe"><input type="date" value={manual.disponibilizacao} onChange={(e) => setManual({ ...manual, disponibilizacao: e.target.value })} /></Campo>
          <Campo rotulo="Tribunal"><input value={manual.tribunal} onChange={(e) => setManual({ ...manual, tribunal: e.target.value })} placeholder="TRF1, TJMA…" /></Campo>
          <Campo rotulo="Número do processo"><input value={manual.processoNumero} onChange={(e) => setManual({ ...manual, processoNumero: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Texto da publicação"><textarea value={manual.texto} onChange={(e) => setManual({ ...manual, texto: e.target.value })} /></Campo>
        {manual.processoNumero && !cnjValido(manual.processoNumero) && <p className="mudo">Número CNJ com dígito verificador inválido — confira.</p>}
        <div className="flex mt"><button className="btn" onClick={adicionarManual}>Adicionar</button></div>
      </div>
    </>
  );
}

function CartaoIntimacao({ b, i }: { b: Banco; i: Intimacao }) {
  const [dias, setDias] = useState(i.dias);
  const [resp, setResp] = useState(i.responsavelId || b.config.usuarioAtualId);
  const [aberto, setAberto] = useState(false);
  const [criarTarefa, setCriarTarefa] = useState(true);
  const calc = prazoJudicial(i.disponibilizacao, Math.max(1, dias || 1), opcoesCalendario(b));
  const situ = situacaoPrazo(calc.fatal, hoje());
  const proc = b.processos.find((p) => p.numero.replace(/\D/g, '') === i.processoNumero.replace(/\D/g, ''));
  const tarefa = b.tarefas.find((t) => t.intimacaoId === i.id);

  const tratar = () =>
    alterar((db) => {
      const prazoId = novoId();
      db.compromissos.push({
        id: prazoId, titulo: `Prazo ${dias}d — ${i.processoNumero}`, data: calc.fatal, origem: 'judicial',
        responsavelId: resp, status: 'pendente', processoId: proc?.id ?? null, base: `Disponib. ${formatar(i.disponibilizacao)}`,
      });
      if (criarTarefa && !db.tarefas.some((t) => t.intimacaoId === i.id)) {
        const etiquetaPrazo = (db.config.etiquetasTarefa || []).find((e) => e.id === 'ett-prazo')?.id;
        db.tarefas.push(tarefaDaIntimacao(i, {
          id: novoId(), dias, fatal: calc.fatal, responsavelId: resp, processoId: proc?.id ?? null,
          nomeCliente: proc ? nomeCliente(db, proc.clienteId) : undefined, etiquetaPrazo, usuarioId: db.config.usuarioAtualId, agora: new Date().toISOString(),
        }));
      }
      const x = db.intimacoes.find((y) => y.id === i.id)!;
      x.status = 'tratada';
      x.dias = dias;
      x.responsavelId = resp;
      x.prazoId = prazoId;
    });

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <span>
          <strong>{i.tribunal}</strong> · <span className="mono">{i.processoNumero}</span>{' '}
          {i.origem === 'djen' && <span className="etiqueta violeta">DJEN</span>}{' '}
          {i.status === 'tratada' ? <span className="etiqueta verde">tratada · {nomeUsuario(b, i.responsavelId)}</span> : <span className="etiqueta ambar">sem tratar</span>}
        </span>
        <span className="mudo num">disponibilizada {formatar(i.disponibilizacao)}</span>
      </div>
      <p style={{ margin: '6px 0 10px', whiteSpace: aberto ? 'pre-wrap' : undefined }} className={aberto ? '' : 'mudo'}>
        {aberto || i.texto.length < 260 ? i.texto : i.texto.slice(0, 260) + '…'}{' '}
        {i.texto.length >= 260 && <button className="btn pequeno" onClick={() => setAberto(!aberto)}>{aberto ? 'menos' : 'ler tudo'}</button>}
      </p>
      <div className="linha-campos" style={{ alignItems: 'end' }}>
        <Campo rotulo="Prazo (dias úteis)"><input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} disabled={i.status === 'tratada'} /></Campo>
        <Campo rotulo="Responsável">
          <select value={resp} onChange={(e) => setResp(e.target.value)} disabled={i.status === 'tratada'}>
            {b.usuarios.filter((u) => u.papel !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
        <div>
          <div className="mudo" style={{ fontSize: '0.8rem' }}>Publicação {formatar(calc.publicacao)} · início {formatar(calc.inicio)}</div>
          <div>Data fatal: <strong className={`num ${situ === 'vencido' || situ === 'hoje' ? '' : ''}`} style={{ color: situ === 'vencido' || situ === 'hoje' ? 'var(--vermelho)' : undefined }}>{formatarComSemana(calc.fatal)}</strong></div>
        </div>
        {i.status === 'nova' && (
          <div className="flex">
            <label className="check" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={criarTarefa} onChange={(e) => setCriarTarefa(e.target.checked)} /> Criar tarefa para o responsável
            </label>
            <button className="btn primario" onClick={tratar}>Gerar prazo</button>
          </div>
        )}
        {tarefa && <Link to="/tarefas?aba=lista" className="mudo" style={{ fontSize: 13 }}>Tarefa criada: {tarefa.titulo} ({ROTULO_SITUACAO[tarefa.coluna]})</Link>}
      </div>
      {calc.avisos.filter((a) => a.includes('conferir')).map((a) => <div key={a} className="aviso mt">{a}</div>)}
    </div>
  );
}
