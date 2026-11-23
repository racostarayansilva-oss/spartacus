// Etiquetas dos processos (como no Legis): cadastro com cor, aplicação no processo e filtro na lista.
import { useState } from 'react';
import { alterar, Banco, Etiqueta, novoId, Processo } from '../store';
import { CORES_ETIQUETA } from '../lib/dadosIniciais';
import { normalizar } from '../lib/importacao';
import { Modal, Vazio } from './ui';

/** Texto preto ou branco conforme a cor de fundo, para ficar legível. */
function corTexto(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#181a20' : '#ffffff';
}

export function ChipEtiqueta({ e, aoRemover }: { e: Etiqueta; aoRemover?: () => void }) {
  return (
    <span className="etiqueta" style={{ background: e.cor, color: corTexto(e.cor), fontWeight: 600 }}>
      {e.nome}
      {aoRemover && (
        <button onClick={(ev) => { ev.stopPropagation(); aoRemover(); }} aria-label={`Remover ${e.nome}`}
          style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, fontSize: 13, lineHeight: 1 }}>×</button>
      )}
    </span>
  );
}

export function etiquetasDoProcesso(b: Banco, p: Processo): Etiqueta[] {
  const todas = b.config.etiquetas || [];
  return (p.etiquetas || []).map((id) => todas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
}

/** Dentro da ficha: mostra as etiquetas do processo e permite pôr/tirar. */
export function SeletorEtiquetas({ b, p }: { b: Banco; p: Processo }) {
  const todas = b.config.etiquetas || [];
  const atuais = etiquetasDoProcesso(b, p);
  const disponiveis = todas.filter((e) => !(p.etiquetas || []).includes(e.id));
  const mudar = (ids: string[]) => alterar((db) => { db.processos.find((x) => x.id === p.id)!.etiquetas = ids; });
  return (
    <div className="flex">
      {atuais.map((e) => <ChipEtiqueta key={e.id} e={e} aoRemover={() => mudar((p.etiquetas || []).filter((id) => id !== e.id))} />)}
      {disponiveis.length > 0 && (
        <select value="" onChange={(ev) => ev.target.value && mudar([...(p.etiquetas || []), ev.target.value])} style={{ width: 'auto', minHeight: 28, padding: '2px 8px', fontSize: 12 }} aria-label="Adicionar etiqueta">
          <option value="">+ Etiqueta</option>
          {disponiveis.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      )}
    </div>
  );
}

/** Aba Etiquetas: lista, busca, criar, editar e excluir. */
export function AbaEtiquetas({ b, aoFiltrar }: { b: Banco; aoFiltrar: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Partial<Etiqueta> | null>(null);
  const todas = b.config.etiquetas || [];
  const lista = todas.filter((e) => !busca || normalizar(e.nome).includes(normalizar(busca)));
  const contagem = (id: string) => b.processos.filter((p) => (p.etiquetas || []).includes(id)).length;

  return (
    <div className="cartao">
      <div className="flex" style={{ marginBottom: 12 }}>
        <input placeholder="Buscar etiquetas…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: '1 1 240px', maxWidth: 420 }} />
        <span className="mudo">{todas.length} etiquetas</span>
        <span style={{ flex: 1 }} />
        <button className="btn primario" onClick={() => setEditar({ nome: '', cor: CORES_ETIQUETA[0] })}>+ Nova etiqueta</button>
      </div>
      {lista.length === 0 ? <Vazio>Nenhuma etiqueta.</Vazio> : (
        <div className="tabela-wrap">
          <table>
            <thead><tr><th style={{ width: 60 }}>Cor</th><th>Nome</th><th style={{ textAlign: 'right' }}>Processos</th><th style={{ width: 200 }}></th></tr></thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td><span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', background: e.cor, verticalAlign: 'middle' }} /></td>
                  <td><strong style={{ color: 'var(--texto-forte)' }}>{e.nome}</strong></td>
                  <td className="num" style={{ textAlign: 'right' }}>{contagem(e.id)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="flex" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn pequeno" onClick={() => aoFiltrar(e.id)} disabled={!contagem(e.id)}>Ver processos</button>
                      <button className="btn pequeno" onClick={() => setEditar(e)}>Editar</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editar && <EditarEtiqueta e={editar} usos={editar.id ? contagem(editar.id) : 0} aoFechar={() => setEditar(null)} />}
    </div>
  );
}

function EditarEtiqueta({ e, usos, aoFechar }: { e: Partial<Etiqueta>; usos: number; aoFechar: () => void }) {
  const [f, setF] = useState(e);
  const salvar = () => {
    const nome = (f.nome || '').trim().toUpperCase();
    if (!nome) return;
    alterar((db) => {
      const lista = db.config.etiquetas || [];
      if (f.id) Object.assign(lista.find((x) => x.id === f.id)!, { nome, cor: f.cor });
      else lista.push({ id: novoId(), nome, cor: f.cor || CORES_ETIQUETA[0] });
      db.config.etiquetas = lista;
    });
    aoFechar();
  };
  const excluir = () => {
    if (usos && !confirm(`A etiqueta está em ${usos} processo(s). Excluir mesmo assim?`)) return;
    alterar((db) => {
      db.config.etiquetas = (db.config.etiquetas || []).filter((x) => x.id !== f.id);
      for (const p of db.processos) if (p.etiquetas?.includes(f.id!)) p.etiquetas = p.etiquetas.filter((id) => id !== f.id);
    });
    aoFechar();
  };
  return (
    <Modal titulo={f.id ? 'Editar etiqueta' : 'Nova etiqueta'} aoFechar={aoFechar}>
      <label className="campo">Nome<input value={f.nome || ''} onChange={(ev) => setF({ ...f, nome: ev.target.value })} autoFocus /></label>
      <div>
        <div className="mudo" style={{ marginBottom: 6 }}>Cor</div>
        <div className="flex">
          {CORES_ETIQUETA.map((c) => (
            <button key={c} onClick={() => setF({ ...f, cor: c })} aria-label={`Cor ${c}`}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: f.cor === c ? '3px solid var(--texto-forte)' : '2px solid transparent' }} />
          ))}
          <input type="color" value={f.cor || '#fcd535'} onChange={(ev) => setF({ ...f, cor: ev.target.value })} style={{ width: 44, minHeight: 30, padding: 2 }} aria-label="Outra cor" />
        </div>
      </div>
      <div className="flex"><span className="mudo">Prévia:</span><ChipEtiqueta e={{ id: '', nome: (f.nome || 'ETIQUETA').toUpperCase(), cor: f.cor || '#fcd535' }} /></div>
      <div className="modal-acoes">
        {f.id && <button className="btn perigo" onClick={excluir}>Excluir</button>}
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        <button className="btn primario" onClick={salvar}>Salvar</button>
      </div>
    </Modal>
  );
}
