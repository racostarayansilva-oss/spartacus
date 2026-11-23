// E-mails dos clientes: o que chegou nos endereços gerados para cada cliente (códigos do gov.br, avisos do Meu INSS…).
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { alterar, Banco, EmailRecebido, MODO_NUVEM, nomeCliente, useBanco, usuarioAtual } from '../store';
import { semTabela } from '../nuvem';
import { normalizar } from '../lib/importacao';
import { htmlSeguro } from '../lib/emailCliente';
import { tamanhoLegivel } from '../lib/pdf';
import { Icone } from '../components/icones';
import { Modal, Paginacao, Segmentos, Topo, Vazio } from '../components/ui';

export const dataHora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const remetente = (de: string) => de.replace(/\s*<[^>]+>$/, '').replace(/^"|"$/g, '') || de;

export function marcarLido(id: string, lido: boolean) {
  alterar((db) => { const e = db.emails.find((x) => x.id === id); if (e) e.lido = lido; });
}

export function LeitorEmail({ email: e, b, aoFechar }: { email: EmailRecebido; b: Banco; aoFechar: () => void }) {
  const [verTexto, setVerTexto] = useState(!e.html);
  return (
    <Modal titulo={e.assunto || '(sem assunto)'} aoFechar={aoFechar} largo>
      <dl className="email-cab">
        <div><dt>De</dt><dd>{e.de}</dd></div>
        <div><dt>Para</dt><dd className="mono">{e.para}</dd></div>
        <div><dt>Cliente</dt><dd>{e.clienteId ? <Link to={`/clientes?cliente=${e.clienteId}`}>{nomeCliente(b, e.clienteId)}</Link> : <span className="sem-dado">Endereço sem cliente</span>}</dd></div>
        <div><dt>Recebido</dt><dd className="num">{dataHora(e.recebidoEm)}</dd></div>
      </dl>
      {e.html && e.texto && (
        <div className="flex" style={{ margin: '4px 0 10px' }}>
          <Segmentos valor={verTexto ? 't' : 'h'} aoMudar={(v) => setVerTexto(v === 't')} opcoes={[['h', 'Formatado'], ['t', 'Só texto']]} />
        </div>
      )}
      {verTexto || !e.html
        ? <pre className="email-texto">{e.texto || '(e-mail sem texto)'}</pre>
        : <iframe className="email-html" title="Conteúdo do e-mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={htmlSeguro(e.html)} />}
      {!!e.anexos?.length && (
        <div className="email-anexos">
          <span className="rotulo-campo">Anexos (não ficam guardados; peça o reenvio se precisar)</span>
          <ul>{e.anexos.map((a, i) => <li key={i}><Icone nome="clipe" tamanho={14} />{a.nome}<span className="mudo num">{tamanhoLegivel(a.tamanho)}</span></li>)}</ul>
        </div>
      )}
    </Modal>
  );
}

export default function EmailsClientes() {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const [params, setParams] = useSearchParams();
  const clienteFiltro = params.get('cliente') || '';
  const [filtro, setFiltro] = useState<'todos' | 'naolidos'>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  const naoLidos = b.emails.filter((e) => !e.lido).length;
  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return b.emails
      .filter((e) => (!clienteFiltro || e.clienteId === clienteFiltro) && (filtro === 'todos' || !e.lido))
      .filter((e) => !q || normalizar(`${e.de} ${e.assunto} ${e.para} ${nomeCliente(b, e.clienteId)}`).includes(q))
      .sort((x, y) => y.recebidoEm.localeCompare(x.recebidoEm));
  }, [b, busca, filtro, clienteFiltro]);
  const pag = lista.slice((pagina - 1) * porPagina, pagina * porPagina);
  const emailAberto = b.emails.find((e) => e.id === aberto);

  const abrir = (e: EmailRecebido) => {
    setAberto(e.id);
    if (!e.lido) marcarLido(e.id, true);
  };
  const excluir = (e: EmailRecebido) => {
    if (confirm(`Excluir o e-mail "${e.assunto}"?`)) alterar((db) => { db.emails = db.emails.filter((x) => x.id !== e.id); });
  };

  return (
    <>
      <Link to="/" className="btn fantasma pequeno voltar"><Icone nome="seta-esq" tamanho={15} />Área de trabalho</Link>
      <Topo titulo="E-mails dos clientes" subtitulo="O que chega nos endereços gerados para os clientes: códigos do gov.br, avisos do Meu INSS e outros." />

      {MODO_NUVEM && semTabela('emails_recebidos') && (
        <div className="erro" style={{ marginBottom: 12 }}>A tabela de e-mails ainda não existe no banco. Peça ao administrador para rodar o supabase/schema.sql de novo no Supabase.</div>
      )}
      {!b.config.dominioEmails && (
        <div className="cartao aviso-config">
          <b>Falta configurar o domínio dos e-mails.</b>
          <span className="mudo">{eu?.papel === 'advogado' ? <>Defina em <Link to="/config">Configurações → E-mails dos clientes</Link>.</> : 'Peça ao administrador para configurar em Configurações.'}</span>
        </div>
      )}

      <div className="cartao secao">
        <div className="filtros-clientes">
          <div className="busca-campo">
            <Icone nome="busca" tamanho={16} />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por remetente, assunto ou cliente" aria-label="Buscar e-mail" />
          </div>
          <Segmentos valor={filtro} aoMudar={(v) => { setFiltro(v); setPagina(1); }} opcoes={[['todos', `Todos (${b.emails.length})`], ['naolidos', `Não lidos (${naoLidos})`]]} />
          {clienteFiltro && (
            <button className="btn pequeno" onClick={() => { params.delete('cliente'); setParams(params); }} title="Mostrar de todos os clientes">
              {nomeCliente(b, clienteFiltro)}<Icone nome="fechar" tamanho={13} />
            </button>
          )}
        </div>

        {lista.length === 0 ? <Vazio>{b.emails.length ? 'Nenhum e-mail com esses filtros.' : 'Nenhum e-mail recebido ainda. Gere o endereço no dossiê do cliente e use-o no cadastro do gov.br.'}</Vazio> : (
          <>
            <div className="tabela-wrap">
              <table className="tabela-emails">
                <thead><tr><th>Situação</th><th>Remetente</th><th>Assunto</th><th>Cliente</th><th>Recebido</th><th><span className="sr">Ações</span></th></tr></thead>
                <tbody>
                  {pag.map((e) => (
                    <tr key={e.id} className={`clicavel${e.lido ? '' : ' nao-lido'}`} onClick={() => abrir(e)} onKeyDown={(k) => k.key === 'Enter' && k.target === k.currentTarget && abrir(e)} tabIndex={0}>
                      <td><span className={`email-status${e.lido ? ' lido' : ''}`}>{e.lido ? 'Lido' : 'Não lido'}</span></td>
                      <td className="email-de">{remetente(e.de)}</td>
                      <td className="email-assunto">{e.assunto}{!!e.anexos?.length && <Icone nome="clipe" tamanho={13} />}</td>
                      <td>
                        {e.clienteId ? <Link to={`/clientes?cliente=${e.clienteId}`} onClick={(k) => k.stopPropagation()}>{nomeCliente(b, e.clienteId)}</Link> : <span className="sem-dado">Sem cliente</span>}
                        <div className="cli-sub mono">{e.para}</div>
                      </td>
                      <td className="num">{dataHora(e.recebidoEm)}</td>
                      <td className="email-acoes" onClick={(k) => k.stopPropagation()}>
                        <button className="btn pequeno fantasma" onClick={() => marcarLido(e.id, !e.lido)}>{e.lido ? 'Marcar não lido' : 'Marcar lido'}</button>
                        <button className="icone-btn" title="Excluir" aria-label={`Excluir e-mail ${e.assunto}`} onClick={() => excluir(e)}><Icone nome="lixeira" tamanho={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao total={lista.length} pagina={pagina} porPagina={porPagina} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} nome="e-mails" />
          </>
        )}
      </div>

      {emailAberto && <LeitorEmail email={emailAberto} b={b} aoFechar={() => setAberto(null)} />}
    </>
  );
}
