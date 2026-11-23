// Robô Gerador: escolhe cliente + modelo, preenche os campos e gera o PDF pelo Ctrl+P.
import { useMemo, useState } from 'react';
import { Topo } from '../components/ui';
import { Icone } from '../components/icones';
import { useBanco, Cliente } from '../store';
import { MODELOS, preencher, Modelo } from '../lib/modelos';
import { documentoHtml, imprimirDocumento } from '../lib/modelosEstilo';

type Extras = { honorarios?: string };

export default function RoboDocumentos({ aoVoltar }: { aoVoltar: () => void }) {
  const b = useBanco();
  const [modeloId, setModeloId] = useState<string>(MODELOS[0].id);
  const [clienteId, setClienteId] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [dados, setDados] = useState<Partial<Cliente> & Extras>({});

  const modelo = MODELOS.find((m) => m.id === modeloId) as Modelo;

  const clientes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return b.clientes.filter((c) => !q || c.nome.toLowerCase().includes(q) || c.cpf.includes(q)).slice(0, 50);
  }, [b.clientes, busca]);

  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id);
    setDados({ ...c });
  };

  const html = useMemo(() => preencher(modelo, dados), [modelo, dados]);
  const precisaHonorarios = modelo.id === 'procuracao-contrato';

  const imprimir = () => {
    if (!imprimirDocumento(`${modelo.nome} — ${dados.nome || ''}`, html)) alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
  };

  const campo = (k: keyof (Cliente & Extras), rotulo: string, largura = 1) => (
    <label style={{ gridColumn: `span ${largura}`, display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--texto-3)' }}>{rotulo}</span>
      <input value={(dados as Record<string, string>)[k as string] || ''} onChange={(e) => setDados((d) => ({ ...d, [k]: e.target.value }))} />
    </label>
  );

  return (
    <>
      <Topo titulo="Robô gerador de documentos" subtitulo={`${modelo.nome} — ${dados.nome || 'sem cliente'}`}>
        <button className="btn fantasma" onClick={aoVoltar}><Icone nome="seta-esq" tamanho={16} />Voltar</button>
        <button className="btn primario" onClick={imprimir}><Icone nome="imprimir" tamanho={16} />Imprimir / PDF</button>
      </Topo>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="cartao" style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--texto-3)' }}>Modelo</span>
            <select value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <small className="mudo">{modelo.descricao}</small>
          </label>
          <div>
            <input placeholder="Buscar cliente por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 6, borderRadius: 'var(--raio-md)', background: 'var(--superficie-2)' }}>
              {clientes.map((c) => (
                <button key={c.id} onClick={() => selecionarCliente(c)} style={{ display: 'block', width: '100%', textAlign: 'left', background: c.id === clienteId ? 'var(--primario-suave)' : 'transparent', border: 0, padding: 8, cursor: 'pointer', color: 'inherit', fontSize: 13 }}>
                  <b>{c.nome}</b> <span className="mudo">· {c.cpf}</span>
                </button>
              ))}
              {!clientes.length && <div style={{ padding: 10, color: 'var(--texto-3)', fontSize: 12 }}>Nenhum cliente encontrado.</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {campo('nome', 'Nome', 2)}
            {campo('cpf', 'CPF')}
            {campo('rg', 'RG')}
            {campo('estadoCivil', 'Estado civil')}
            {campo('profissao', 'Profissão')}
            {campo('telefone', 'Telefone')}
            {campo('email', 'E-mail')}
            {campo('endereco', 'Endereço', 2)}
            {campo('numero', 'Nº')}
            {campo('bairro', 'Bairro')}
            {campo('cidade', 'Cidade')}
            {campo('uf', 'UF')}
            {campo('cep', 'CEP', 2)}
            {precisaHonorarios && campo('honorarios', 'Honorários (valor ou %)', 2)}
          </div>
        </div>
        <iframe
          title="Pré-visualização"
          srcDoc={documentoHtml(modelo.nome, html, true)}
          style={{ width: '100%', height: 'calc(100vh - 220px)', background: '#fff', border: '1px solid var(--borda)', borderRadius: 'var(--raio-lg)' }}
        />
      </div>
    </>
  );
}
