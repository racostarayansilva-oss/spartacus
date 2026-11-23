// Botão "Registrar movimentação": cada pessoa da equipe lança sua produção do dia.
import { useState } from 'react';
import { alterar, Canal, novoId, Registro, TipoRegistro, useBanco, Testemunha } from '../store';
import { hoje } from '../lib/datas';
import { Campo, Modal } from './ui';

export const ROTULO_REGISTRO: Record<TipoRegistro, string> = {
  entrada: 'Entrada de cliente',
  protocolo: 'Protocolo',
  despacho: 'Despacho',
  sentenca: 'Sentença',
  recurso: 'Recurso interposto',
  audiencia: 'Audiência marcada',
  dilacao: 'Dilação de prazo',
  exigencia: 'Cumprimento de exigência',
};

export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  trafego: 'Tráfego pago',
  corretor: 'Corretor parceiro',
  indicacao: 'Indicação',
  presencial: 'Presencial',
  outro: 'Outro',
};

export function RegistrarMovimentacao({ processoId, aoFechar }: { processoId?: string; aoFechar: () => void }) {
  const b = useBanco();
  const [tipo, setTipo] = useState<TipoRegistro>('entrada');
  const [data, setData] = useState(hoje());
  const [canal, setCanal] = useState<Canal>('whatsapp');
  const [resultado, setResultado] = useState<Registro['resultado']>('favoravel');
  const [proc, setProc] = useState(processoId || '');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [aud, setAud] = useState({ data: hoje(), hora: '09:00', local: '' });
  const [testemunhas, setTestemunhas] = useState<Testemunha[]>([{ nome: '', telefone: '' }]);
  const [erro, setErro] = useState('');

  const salvar = () => {
    if (tipo === 'audiencia' && !proc) return setErro('Escolha o processo da audiência.');
    alterar((db) => {
      for (let i = 0; i < Math.max(1, quantidade); i++) {
        db.registros.push({
          id: novoId(),
          data,
          tipo,
          usuarioId: db.config.usuarioAtualId,
          processoId: proc || null,
          canal: tipo === 'entrada' ? canal : undefined,
          resultado: tipo === 'despacho' || tipo === 'sentenca' ? resultado : undefined,
          descricao: descricao || undefined,
        });
      }
      if (tipo === 'audiencia' && proc) {
        db.audiencias.push({
          id: novoId(),
          processoId: proc,
          data: aud.data,
          hora: aud.hora,
          local: aud.local,
          testemunhas: testemunhas.filter((t) => t.nome.trim()),
          clienteContatado: false,
          testemunhasConfirmadas: false,
        });
      }
    });
    aoFechar();
  };

  return (
    <Modal titulo="Registrar movimentação" aoFechar={aoFechar}>
      <div className="linha-campos">
        <Campo rotulo="Tipo">
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoRegistro); setResultado(e.target.value === 'sentenca' ? 'procedente' : 'favoravel'); }}>
            {Object.entries(ROTULO_REGISTRO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        {tipo !== 'audiencia' && (
          <Campo rotulo="Quantidade">
            <input type="number" min={1} max={200} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value) || 1)} />
          </Campo>
        )}
      </div>
      {tipo === 'entrada' && (
        <Campo rotulo="Canal de entrada">
          <select value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
            {Object.entries(ROTULO_CANAL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
      )}
      {tipo === 'despacho' && (
        <Campo rotulo="Resultado">
          <select value={resultado} onChange={(e) => setResultado(e.target.value as Registro['resultado'])}>
            <option value="favoravel">Favorável</option>
            <option value="desfavoravel">Desfavorável</option>
          </select>
        </Campo>
      )}
      {tipo === 'sentenca' && (
        <Campo rotulo="Resultado">
          <select value={resultado} onChange={(e) => setResultado(e.target.value as Registro['resultado'])}>
            <option value="procedente">Procedente</option>
            <option value="parcial">Parcialmente procedente</option>
            <option value="improcedente">Improcedente</option>
          </select>
        </Campo>
      )}
      <Campo rotulo={tipo === 'audiencia' ? 'Processo' : 'Processo (opcional)'}>
        <select value={proc} onChange={(e) => setProc(e.target.value)}>
          <option value="">—</option>
          {b.processos.map((p) => (
            <option key={p.id} value={p.id}>{p.numero} — {b.clientes.find((c) => c.id === p.clienteId)?.nome}</option>
          ))}
        </select>
      </Campo>
      {tipo === 'audiencia' && (
        <>
          <div className="linha-campos">
            <Campo rotulo="Data da audiência"><input type="date" value={aud.data} onChange={(e) => setAud({ ...aud, data: e.target.value })} /></Campo>
            <Campo rotulo="Hora"><input type="time" value={aud.hora} onChange={(e) => setAud({ ...aud, hora: e.target.value })} /></Campo>
            <Campo rotulo="Local"><input value={aud.local} onChange={(e) => setAud({ ...aud, local: e.target.value })} placeholder="Vara / sala virtual" /></Campo>
          </div>
          <strong style={{ fontSize: '0.88rem' }}>Testemunhas</strong>
          {testemunhas.map((t, i) => (
            <div className="linha-campos" key={i}>
              <input placeholder="Nome" value={t.nome} onChange={(e) => setTestemunhas(testemunhas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
              <input placeholder="Telefone" value={t.telefone} onChange={(e) => setTestemunhas(testemunhas.map((x, j) => (j === i ? { ...x, telefone: e.target.value } : x)))} />
            </div>
          ))}
          <div><button className="btn pequeno" type="button" onClick={() => setTestemunhas([...testemunhas, { nome: '', telefone: '' }])}>+ Testemunha</button></div>
        </>
      )}
      <Campo rotulo="Observação">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>
      {erro && <div className="erro">{erro}</div>}
      <div className="modal-acoes">
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        <button className="btn primario" onClick={salvar}>Registrar</button>
      </div>
    </Modal>
  );
}
