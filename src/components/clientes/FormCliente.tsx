// Cadastro do cliente (novo ou edição). O corretor pode ser cadastrado aqui mesmo, sem sair do formulário.
import { InputHTMLAttributes, useState } from 'react';
import { alterar, Beneficio, Cliente, novoId, useBanco } from '../../store';
import { cpfValido, formatarCpf, somenteDigitos } from '../../lib/cpf';
import { hoje } from '../../lib/datas';
import { BENEFICIOS, documentosPadrao } from '../../lib/dossie';
import { Campo, Modal } from '../ui';

const ORIGEM: Record<Cliente['origem'], string> = { corretor: 'Corretor parceiro', indicacao: 'Indicação', trafego: 'Tráfego pago', nao_informada: 'Não informada' };
const NOVO_CORRETOR = '__novo';

export default function FormCliente({ cliente, aoFechar, aoSalvar }: { cliente?: Cliente; aoFechar: () => void; aoSalvar?: (id: string) => void }) {
  const b = useBanco();
  const [f, setF] = useState<Partial<Cliente>>(cliente ?? { origem: 'nao_informada', responsavelId: b.config.usuarioAtualId });
  const [corretorNovo, setCorretorNovo] = useState<{ nome: string; telefone: string } | null>(null);
  const [erro, setErro] = useState('');
  const mudar = (p: Partial<Cliente>) => setF((x) => ({ ...x, ...p }));
  const campo = (k: keyof Cliente, rotulo: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Campo rotulo={rotulo}>
      <input value={(f[k] as string) ?? ''} onChange={(e) => mudar({ [k]: e.target.value })} {...props} />
    </Campo>
  );

  const salvar = () => {
    if (!f.nome?.trim()) return setErro('Informe o nome do cliente.');
    if (f.cpf && !cpfValido(f.cpf)) return setErro('CPF inválido. Confira os números.');
    const cpf = somenteDigitos(f.cpf || '');
    if (cpf && b.clientes.some((c) => c.cpf === cpf && c.id !== f.id)) return setErro('Já existe um cliente com este CPF.');
    if (corretorNovo && !corretorNovo.nome.trim()) return setErro('Informe o nome do corretor novo.');

    const id = f.id ?? novoId();
    alterar((db) => {
      let corretorId = f.corretorId ?? null;
      if (corretorNovo) {
        corretorId = novoId();
        db.corretores.push({ id: corretorId, nome: corretorNovo.nome.trim(), telefone: corretorNovo.telefone.trim(), regioes: f.cidade ? [f.cidade.trim()] : [] });
      }
      const anterior = db.clientes.find((c) => c.id === id);
      // Benefício escolhido e ainda sem lista: já entra com os documentos padrão a conferir
      const documentos = (anterior?.documentos?.length || f.documentos?.length) ? (f.documentos ?? anterior?.documentos) : documentosPadrao(f.beneficio, novoId);
      const dados: Cliente = {
        ...(anterior ?? { id, criadoEm: hoje() }), ...f,
        id, nome: f.nome!.trim(), cpf, telefone: (f.telefone || '').trim(), uf: f.uf?.trim().toUpperCase() || undefined,
        origem: corretorId ? 'corretor' : f.origem === 'corretor' ? 'nao_informada' : (f.origem ?? 'nao_informada'),
        corretorId, documentos, criadoEm: anterior?.criadoEm ?? hoje(),
      } as Cliente;
      if (anterior) Object.assign(anterior, dados);
      else {
        db.clientes.push(dados);
        db.registros.push({ id: novoId(), data: hoje(), tipo: 'entrada', canal: corretorId ? 'corretor' : dados.origem === 'indicacao' ? 'indicacao' : dados.origem === 'trafego' ? 'trafego' : 'outro', usuarioId: db.config.usuarioAtualId, descricao: dados.nome });
      }
    });
    aoSalvar?.(id);
    aoFechar();
  };

  return (
    <Modal titulo={cliente ? 'Editar cadastro' : 'Novo cliente'} aoFechar={aoFechar} largo>
      <section className="form-secao">
        <h4>Identificação</h4>
        <div className="form-grade">
          <div className="span-2">{campo('nome', 'Nome completo', { autoFocus: !cliente })}</div>
          <Campo rotulo="CPF"><input value={formatarCpf(f.cpf || '')} onChange={(e) => mudar({ cpf: e.target.value })} inputMode="numeric" placeholder="000.000.000-00" /></Campo>
          {campo('rg', 'RG')}
          {campo('nascimento', 'Data de nascimento', { type: 'date', max: hoje() })}
          <Campo rotulo="Sexo">
            <select value={f.sexo ?? ''} onChange={(e) => mudar({ sexo: (e.target.value || undefined) as Cliente['sexo'] })}>
              <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option>
            </select>
          </Campo>
          {campo('estadoCivil', 'Estado civil')}
          {campo('profissao', 'Profissão')}
        </div>
      </section>

      <section className="form-secao">
        <h4>Contato e endereço</h4>
        <div className="form-grade">
          {campo('telefone', 'Telefone / WhatsApp', { inputMode: 'tel' })}
          {campo('email', 'E-mail', { type: 'email' })}
          <div className="span-2">{campo('endereco', 'Endereço')}</div>
          {campo('numero', 'Nº')}
          {campo('bairro', 'Bairro')}
          {campo('cidade', 'Cidade')}
          <div className="form-grade-uf">
            {campo('uf', 'UF', { maxLength: 2, style: { textTransform: 'uppercase' } })}
            {campo('cep', 'CEP', { inputMode: 'numeric' })}
          </div>
        </div>
      </section>

      <section className="form-secao">
        <h4>Atendimento</h4>
        <div className="form-grade">
          <Campo rotulo="Benefício pretendido">
            <select value={f.beneficio ?? ''} onChange={(e) => mudar({ beneficio: (e.target.value || undefined) as Beneficio })}>
              <option value="">—</option>
              {(Object.keys(BENEFICIOS) as Beneficio[]).map((k) => <option key={k} value={k}>{BENEFICIOS[k].rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Corretor">
            <select
              value={corretorNovo ? NOVO_CORRETOR : f.corretorId ?? ''}
              onChange={(e) => {
                if (e.target.value === NOVO_CORRETOR) { setCorretorNovo({ nome: '', telefone: '' }); return; }
                setCorretorNovo(null);
                mudar({ corretorId: e.target.value || null });
              }}
            >
              <option value="">Sem corretor</option>
              {[...b.corretores].sort((x, y) => x.nome.localeCompare(y.nome)).map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
              <option value={NOVO_CORRETOR}>+ Cadastrar corretor…</option>
            </select>
          </Campo>
          {corretorNovo && (
            <div className="span-2 corretor-novo">
              <Campo rotulo="Nome do corretor"><input autoFocus value={corretorNovo.nome} onChange={(e) => setCorretorNovo({ ...corretorNovo, nome: e.target.value })} /></Campo>
              <Campo rotulo="Telefone do corretor"><input value={corretorNovo.telefone} onChange={(e) => setCorretorNovo({ ...corretorNovo, telefone: e.target.value })} inputMode="tel" /></Campo>
            </div>
          )}
          {!f.corretorId && !corretorNovo && (
            <Campo rotulo="Como chegou">
              <select value={f.origem === 'corretor' ? 'nao_informada' : f.origem} onChange={(e) => mudar({ origem: e.target.value as Cliente['origem'] })}>
                {(['indicacao', 'trafego', 'nao_informada'] as const).map((v) => <option key={v} value={v}>{ORIGEM[v]}</option>)}
              </select>
            </Campo>
          )}
          <Campo rotulo="Responsável no escritório">
            <select value={f.responsavelId ?? ''} onChange={(e) => mudar({ responsavelId: e.target.value || undefined })}>
              <option value="">—</option>
              {b.usuarios.filter((u) => u.papel !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <div className="span-2">
            <Campo rotulo="Observações gerais"><textarea rows={3} value={f.obs ?? ''} onChange={(e) => mudar({ obs: e.target.value })} /></Campo>
          </div>
        </div>
        {!cliente && f.beneficio && <p className="mudo" style={{ margin: '8px 0 0' }}>A lista de documentos de {BENEFICIOS[f.beneficio].rotulo.toLowerCase()} entra pronta no dossiê para conferir.</p>}
      </section>

      {erro && <div className="erro">{erro}</div>}
      <div className="modal-acoes">
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        <button className="btn primario" onClick={salvar}>{cliente ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
      </div>
    </Modal>
  );
}
