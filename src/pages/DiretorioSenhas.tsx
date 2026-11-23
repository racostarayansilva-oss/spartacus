// Diretório de senhas: acessos do escritório e dos clientes (gov.br, Meu INSS, PJe…).
// Só administradores veem e alteram; na nuvem o próprio banco bloqueia os demais (tabela "senhas").
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, MODO_NUVEM, nomeUsuario, novoId, Senha, useBanco, usuarioAtual } from '../store';
import { semTabela } from '../nuvem';
import { normalizar } from '../lib/importacao';
import { Icone } from '../components/icones';
import { Campo, Modal, Topo, Vazio } from '../components/ui';
import { dataHora } from './EmailsClientes';

type Rascunho = Omit<Senha, 'id' | 'atualizadoEm' | 'atualizadoPor'>;
const VAZIO: Rascunho = { titulo: '', email: '', telefone: '', usuario: '', senha: '', observacao: '' };

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="icone-btn" title={ok ? 'Copiado' : `Copiar ${rotulo}`} aria-label={`Copiar ${rotulo}`} onClick={async () => {
      try { await navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 1500); } catch { alert('Não foi possível copiar.'); }
    }}>
      <Icone nome={ok ? 'concluir' : 'copiar'} tamanho={14} />
    </button>
  );
}

function Formulario({ inicial, aoSalvar, aoFechar, novo }: { inicial: Rascunho; aoSalvar: (r: Rascunho) => void; aoFechar: () => void; novo: boolean }) {
  const [r, setR] = useState(inicial);
  const [ver, setVer] = useState(novo);
  const campo = (k: keyof Rascunho) => ({ value: r[k] ?? '', onChange: (e: { target: { value: string } }) => setR({ ...r, [k]: e.target.value }) });
  return (
    <Modal titulo={novo ? 'Nova senha' : 'Editar senha'} aoFechar={aoFechar}>
      <form className="grade" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (r.titulo.trim()) aoSalvar({ ...r, titulo: r.titulo.trim() }); }}>
        <Campo rotulo="Título *"><input {...campo('titulo')} placeholder="Ex.: Meu INSS — Maria das Graças" autoFocus required /></Campo>
        <div className="linha-campos">
          <Campo rotulo="E-mail"><input type="email" {...campo('email')} autoComplete="off" /></Campo>
          <Campo rotulo="Telefone"><input type="tel" {...campo('telefone')} autoComplete="off" /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Usuário / login"><input {...campo('usuario')} autoComplete="off" placeholder="CPF, e-mail ou nome de usuário" /></Campo>
          <label className="campo">
            Senha
            <span className="senha-campo">
              <input type={ver ? 'text' : 'password'} {...campo('senha')} autoComplete="new-password" className="mono" />
              <button type="button" className="icone-btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} title={ver ? 'Esconder' : 'Mostrar'}>
                <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={15} />
              </button>
            </span>
          </label>
        </div>
        <Campo rotulo="Observação"><textarea rows={3} {...campo('observacao')} placeholder="Ex.: conta gov.br nível prata; código chega no e-mail gerado do cliente." /></Campo>
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario" disabled={!r.titulo.trim()}>Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function SenhaOculta({ senha }: { senha: string }) {
  const [ver, setVer] = useState(false);
  return (
    <span className="senha-valor">
      <span className="mono">{ver ? senha : '••••••••'}</span>
      <button className="icone-btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} title={ver ? 'Esconder' : 'Mostrar'}>
        <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={14} />
      </button>
      <Copiar valor={senha} rotulo="senha" />
    </span>
  );
}

export default function DiretorioSenhas() {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Senha | 'nova' | null>(null);

  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return [...b.senhas]
      .filter((s) => !q || normalizar(`${s.titulo} ${s.email} ${s.telefone} ${s.usuario} ${s.observacao}`).includes(q))
      .sort((x, y) => x.titulo.localeCompare(y.titulo, 'pt-BR'));
  }, [b.senhas, busca]);

  if (eu?.papel !== 'advogado') {
    return (
      <>
        <Topo titulo="Diretório de senhas" />
        <div className="cartao"><Vazio>Disponível só para administradores.</Vazio></div>
      </>
    );
  }

  const salvar = (r: Rascunho) => {
    const agora = new Date().toISOString();
    alterar((db) => {
      if (editando && editando !== 'nova') {
        const s = db.senhas.find((x) => x.id === editando.id);
        if (s) Object.assign(s, r, { atualizadoEm: agora, atualizadoPor: eu.id });
      } else {
        db.senhas.push({ id: novoId(), ...r, atualizadoEm: agora, atualizadoPor: eu.id });
      }
    });
    setEditando(null);
  };
  const excluir = (s: Senha) => {
    if (confirm(`Excluir "${s.titulo}" do diretório? Não dá para desfazer.`)) alterar((db) => { db.senhas = db.senhas.filter((x) => x.id !== s.id); });
  };

  return (
    <>
      <Link to="/" className="btn fantasma pequeno voltar"><Icone nome="seta-esq" tamanho={15} />Área de trabalho</Link>
      <Topo titulo="Diretório de senhas" subtitulo="Acessos do escritório e dos clientes. Só administradores veem e alteram.">
        <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} />Nova senha</button>
      </Topo>

      {MODO_NUVEM && semTabela('senhas') && (
        <div className="erro" style={{ marginBottom: 12 }}>A tabela de senhas ainda não existe no banco. Rode o supabase/schema.sql de novo no Supabase (SQL Editor) para começar a salvar.</div>
      )}

      <div className="cartao secao">
        <div className="filtros-clientes">
          <div className="busca-campo">
            <Icone nome="busca" tamanho={16} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, e-mail, telefone, usuário ou observação" aria-label="Buscar senha" />
          </div>
          <span className="mudo num">{b.senhas.length} {b.senhas.length === 1 ? 'acesso' : 'acessos'}</span>
        </div>

        {lista.length === 0 ? <Vazio>{b.senhas.length ? 'Nada encontrado com essa busca.' : 'Nenhuma senha cadastrada ainda.'}</Vazio> : (
          <div className="tabela-wrap">
            <table className="tabela-senhas">
              <thead><tr><th>Título</th><th>E-mail</th><th>Telefone</th><th>Usuário</th><th>Senha</th><th>Observação</th><th><span className="sr">Ações</span></th></tr></thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="cli-nome">{s.titulo}</div>
                      <div className="cli-sub">Alterado em {dataHora(s.atualizadoEm)}{s.atualizadoPor && ` por ${nomeUsuario(b, s.atualizadoPor)}`}</div>
                    </td>
                    <td>{s.email ? <span className="copiavel"><span>{s.email}</span><Copiar valor={s.email} rotulo="e-mail" /></span> : <span className="sem-dado">—</span>}</td>
                    <td className="num">{s.telefone || <span className="sem-dado">—</span>}</td>
                    <td>{s.usuario ? <span className="copiavel"><span className="mono">{s.usuario}</span><Copiar valor={s.usuario} rotulo="usuário" /></span> : <span className="sem-dado">—</span>}</td>
                    <td>{s.senha ? <SenhaOculta senha={s.senha} /> : <span className="sem-dado">—</span>}</td>
                    <td className="senha-obs">{s.observacao || <span className="sem-dado">—</span>}</td>
                    <td className="email-acoes">
                      <button className="icone-btn" title="Editar" aria-label={`Editar ${s.titulo}`} onClick={() => setEditando(s)}><Icone nome="editar" tamanho={15} /></button>
                      <button className="icone-btn" title="Excluir" aria-label={`Excluir ${s.titulo}`} onClick={() => excluir(s)}><Icone nome="lixeira" tamanho={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <Formulario
          novo={editando === 'nova'}
          inicial={editando === 'nova' ? VAZIO : { titulo: editando.titulo, email: editando.email, telefone: editando.telefone, usuario: editando.usuario, senha: editando.senha, observacao: editando.observacao }}
          aoSalvar={salvar}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}
