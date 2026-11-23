// Formulário do processo: usado em "Novo processo" (lista) e "Editar" (ficha).
import { useMemo, useState } from 'react';
import { alterar, Cliente, novoId, Processo, useBanco } from '../store';
import { ETAPAS, ROTULO_TIPO, TipoProcesso } from '../lib/etapas';
import { cnjValido, formatarCnj } from '../lib/cnj';
import { cpfValido, formatarCpf, somenteDigitos } from '../lib/cpf';
import { hoje } from '../lib/datas';
import { CLIENTE_A_IDENTIFICAR, normalizar } from '../lib/importacao';
import { montarAssunto, partesDoAssunto } from '../lib/processos';
import { Campo, Modal } from './ui';

const MAX_OPCOES = 100;

export function FormProcesso({ processo, aoFechar, aoSalvar }: { processo?: Processo; aoFechar: () => void; aoSalvar?: (id: string) => void }) {
  const b = useBanco();
  const editando = !!processo;
  const inicial = partesDoAssunto(processo?.assunto || '');
  const [f, setF] = useState({
    tipo: processo?.tipo ?? ('JEF' as TipoProcesso),
    numero: processo?.numero ?? '',
    clienteId: processo?.clienteId ?? '',
    classe: inicial.classe,
    contra: inicial.contra,
    responsavelId: processo ? processo.responsavelId : b.config.usuarioAtualId,
    valor: processo?.valor ?? 0,
    corretorId: processo?.corretorId ?? null,
    regiao: processo?.regiao ?? '',
  });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [novoCliente, setNovoCliente] = useState<{ nome: string; cpf: string; telefone: string } | null>(null);
  const [erro, setErro] = useState('');

  const clienteAtual = b.clientes.find((c) => c.id === f.clienteId);
  const aIdentificar = clienteAtual?.nome === CLIENTE_A_IDENTIFICAR;

  // Com milhares de clientes, a lista mostra só os que batem com a busca
  const opcoesCliente = useMemo(() => {
    const t = normalizar(buscaCliente);
    const tDig = somenteDigitos(buscaCliente);
    const achados = b.clientes.filter((c) => !t || normalizar(c.nome).includes(t) || (tDig.length >= 3 && c.cpf.includes(tDig)));
    const lista = achados.slice(0, MAX_OPCOES);
    if (clienteAtual && !lista.includes(clienteAtual)) lista.unshift(clienteAtual);
    return { lista: lista.sort((x, y) => x.nome.localeCompare(y.nome)), total: achados.length };
  }, [b.clientes, buscaCliente, clienteAtual]);

  const digitos = somenteDigitos(f.numero);
  const ehCnj = f.tipo !== 'ADM_INSS';

  const salvar = () => {
    setErro('');
    if (!f.numero.trim()) return setErro('Informe o número (CNJ ou NB).');
    if (!novoCliente && !f.clienteId) return setErro('Escolha o cliente ou cadastre um novo.');
    if (novoCliente && !novoCliente.nome.trim()) return setErro('Informe o nome do novo cliente.');
    if (novoCliente?.cpf && !cpfValido(novoCliente.cpf)) return setErro('CPF do novo cliente inválido.');
    const duplicado = b.processos.find((p) => p.id !== processo?.id && somenteDigitos(p.numero) === digitos && digitos.length > 0);
    if (duplicado) return setErro(`Já existe um processo com este número (${duplicado.numero}).`);

    const numero = ehCnj ? formatarCnj(f.numero.trim()) : f.numero.trim();
    const id = processo?.id ?? novoId();
    alterar((db) => {
      let clienteId = f.clienteId;
      if (novoCliente) {
        const c: Cliente = {
          id: novoId(), nome: novoCliente.nome.trim(), cpf: somenteDigitos(novoCliente.cpf), telefone: novoCliente.telefone.trim(),
          origem: f.corretorId ? 'corretor' : 'nao_informada', corretorId: f.corretorId,
          responsavelId: f.responsavelId || undefined, criadoEm: hoje(),
        };
        db.clientes.push(c);
        clienteId = c.id;
        // Cliente novo junto com processo novo conta como entrada no Painel
        if (!editando) {
          db.registros.push({ id: novoId(), data: hoje(), tipo: 'entrada', canal: f.corretorId ? 'corretor' : 'outro', usuarioId: db.config.usuarioAtualId, descricao: c.nome });
        }
      }
      const dados = {
        numero, tipo: f.tipo, clienteId, assunto: montarAssunto(f.classe, f.contra), responsavelId: f.responsavelId,
        valor: Number(f.valor) || 0, corretorId: f.corretorId, regiao: f.regiao.trim(),
      };
      const existente = db.processos.find((p) => p.id === id);
      if (existente) Object.assign(existente, dados);
      else db.processos.push({ ...dados, id, etapas: [{ etapa: 'Entrada', data: hoje() }], grupoFamiliar: [] });
    });
    aoFechar();
    aoSalvar?.(id);
  };

  return (
    <Modal titulo={editando ? 'Editar processo' : 'Novo processo'} aoFechar={aoFechar}>
      <div className="linha-campos">
        <Campo rotulo="Tipo">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoProcesso })}>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo={ehCnj ? 'Número CNJ' : 'NB / protocolo'}>
          <input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} className="mono" />
        </Campo>
      </div>
      {ehCnj && digitos.length === 20 && !cnjValido(f.numero) && <div className="aviso">Dígito verificador do número CNJ não confere.</div>}
      {editando && processo && f.tipo !== processo.tipo && (
        <div className="aviso">As etapas já registradas continuam. As próximas seguem o tipo {ROTULO_TIPO[f.tipo]}: {ETAPAS[f.tipo].join(' → ')}.</div>
      )}

      {/* Cliente */}
      <div>
        <div className="flex entre" style={{ marginBottom: 4 }}>
          <strong style={{ fontSize: '0.88rem' }}>Cliente</strong>
          <button type="button" className="btn pequeno" onClick={() => setNovoCliente(novoCliente ? null : { nome: '', cpf: '', telefone: '' })}>
            {novoCliente ? 'Escolher cliente existente' : '+ Cadastrar cliente novo'}
          </button>
        </div>
        {novoCliente ? (
          <div className="linha-campos">
            <Campo rotulo="Nome"><input value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} autoFocus /></Campo>
            <Campo rotulo="CPF (opcional)"><input value={formatarCpf(novoCliente.cpf)} onChange={(e) => setNovoCliente({ ...novoCliente, cpf: e.target.value })} inputMode="numeric" /></Campo>
            <Campo rotulo="Telefone (opcional)"><input value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} /></Campo>
          </div>
        ) : (
          <div className="linha-campos">
            <Campo rotulo="Buscar por nome ou CPF">
              <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Digite parte do nome…" />
            </Campo>
            <Campo rotulo={opcoesCliente.total > MAX_OPCOES ? `Escolha (${MAX_OPCOES} de ${opcoesCliente.total}; refine a busca)` : 'Escolha'}>
              <select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
                <option value="">—</option>
                {opcoesCliente.lista.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cpf ? ` · ${formatarCpf(c.cpf)}` : ''}</option>)}
              </select>
            </Campo>
          </div>
        )}
        {!novoCliente && aIdentificar && <div className="aviso mt">Este processo veio da importação sem a parte identificada. Escolha o cliente certo ou cadastre um novo.</div>}
      </div>

      <div className="linha-campos">
        <Campo rotulo="Assunto / classe"><input value={f.classe} onChange={(e) => setF({ ...f, classe: e.target.value })} placeholder="Aposentadoria por idade rural" /></Campo>
        <Campo rotulo="Parte contrária"><input value={f.contra} onChange={(e) => setF({ ...f, contra: e.target.value })} placeholder="INSS" /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Responsável">
          <select value={f.responsavelId} onChange={(e) => setF({ ...f, responsavelId: e.target.value })}>
            <option value="">Sem responsável</option>
            {b.usuarios.filter((u) => u.papel !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor da causa (R$)"><input type="number" min={0} step="0.01" value={f.valor || ''} onChange={(e) => setF({ ...f, valor: Number(e.target.value) })} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Corretor">
          <select value={f.corretorId || ''} onChange={(e) => setF({ ...f, corretorId: e.target.value || null })}>
            <option value="">—</option>
            {b.corretores.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Órgão / vara / região"><input value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} placeholder="Tomé-Açu" /></Campo>
      </div>
      {!editando && <p className="mudo" style={{ margin: 0 }}>Etapas do tipo {ROTULO_TIPO[f.tipo]}: {ETAPAS[f.tipo].join(' → ')}</p>}
      {erro && <div className="erro">{erro}</div>}
      <div className="modal-acoes">
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        <button className="btn primario" onClick={salvar}>{editando ? 'Salvar alterações' : 'Criar'}</button>
      </div>
    </Modal>
  );
}
