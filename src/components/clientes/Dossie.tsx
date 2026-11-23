// Dossiê do cliente: cadastro, benefício com análise de idade, documentos que faltam, anotações datadas e processos.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { alterar, Cliente, nomeUsuario, novoId, useBanco, usuarioAtual } from '../../store';
import { formatarCpf } from '../../lib/cpf';
import { formatar, hoje } from '../../lib/datas';
import { analiseIdade, BENEFICIOS, documentosPadrao, dossieHtml, dossieTexto, pendentes } from '../../lib/dossie';
import { imprimirDocumento } from '../../lib/modelosEstilo';
import { Icone } from '../icones';
import { Topo, Vazio } from '../ui';
import FormCliente from './FormCliente';
import { gerarEmailCliente } from '../../lib/emailCliente';
import { dataHora, LeitorEmail, marcarLido } from '../../pages/EmailsClientes';

/** Endereço de e-mail do escritório para este cliente e os últimos e-mails que chegaram nele. */
function EmailDoCliente({ c }: { c: Cliente }) {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const dominio = b.config.dominioEmails;
  const recebidos = b.emails.filter((e) => e.clienteId === c.id).sort((x, y) => y.recebidoEm.localeCompare(x.recebidoEm));
  const naoLidos = recebidos.filter((e) => !e.lido).length;
  const emailAberto = recebidos.find((e) => e.id === aberto);

  const gerar = () => {
    if (!dominio) return;
    try {
      const emUso = new Set(b.clientes.map((x) => x.emailGerado).filter(Boolean) as string[]);
      const novo = gerarEmailCliente(c.nome, dominio, emUso);
      alterar((db) => { const x = db.clientes.find((y) => y.id === c.id); if (x) x.emailGerado = novo; });
    } catch (e: any) { alert(e.message); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(c.emailGerado!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { alert('Não foi possível copiar.'); }
  };

  return (
    <div className="cartao">
      <div className="cartao-cab">
        <h3>E-mail do cliente no escritório</h3>
        {naoLidos > 0 && <span className="at-selo conta num">{naoLidos}</span>}
      </div>
      {c.emailGerado ? (
        <>
          <div className="email-gerado">
            <span className="mono">{c.emailGerado}</span>
            <button className="icone-btn" onClick={copiar} title={copiado ? 'Copiado' : 'Copiar endereço'} aria-label="Copiar endereço"><Icone nome={copiado ? 'concluir' : 'copiar'} tamanho={15} /></button>
          </div>
          <p className="mudo pequeno-txt">Use este endereço no gov.br, no Meu INSS e em outros cadastros do cliente. O que chegar aparece aqui e em E-mails dos clientes.</p>
          {recebidos.length === 0 ? <p className="mudo" style={{ margin: '8px 0 0' }}>Nenhum e-mail recebido ainda.</p> : (
            <ul className="emails-mini">
              {recebidos.slice(0, 4).map((e) => (
                <li key={e.id} className={e.lido ? '' : 'nao-lido'}>
                  <button className="emails-mini-item" onClick={() => { setAberto(e.id); if (!e.lido) marcarLido(e.id, true); }}>
                    <b>{e.assunto}</b>
                    <span className="mudo num">{dataHora(e.recebidoEm)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {recebidos.length > 0 && <Link to={`/emails?cliente=${c.id}`} className="btn pequeno" style={{ marginTop: 10 }}>Ver todos ({recebidos.length})</Link>}
        </>
      ) : dominio ? (
        <div className="grade" style={{ gap: 8, justifyItems: 'start' }}>
          <p className="mudo" style={{ margin: 0 }}>Crie um e-mail para cadastrar o cliente no gov.br e no Meu INSS. Os códigos e avisos chegam aqui, sem depender do e-mail pessoal do cliente.</p>
          <button className="btn" onClick={gerar}><Icone nome="email" tamanho={15} />Gerar e-mail</button>
        </div>
      ) : (
        <p className="mudo" style={{ margin: 0 }}>
          Para gerar e-mails dos clientes, falta configurar o domínio.{' '}
          {eu?.papel === 'advogado' ? <Link to="/config">Configurar agora</Link> : 'Peça ao administrador (Configurações).'}
        </p>
      )}
      {emailAberto && <LeitorEmail email={emailAberto} b={b} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

export default function Dossie({ cliente: c, aoVoltar }: { cliente: Cliente; aoVoltar: () => void }) {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const h = hoje();
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [novoDoc, setNovoDoc] = useState('');
  const [nota, setNota] = useState({ data: h, texto: '' });

  const analise = analiseIdade(c, h);
  const docs = c.documentos ?? [];
  const faltam = pendentes(c);
  const anotacoes = [...(c.anotacoes ?? [])].sort((x, y) => y.data.localeCompare(x.data));
  const corretor = b.corretores.find((k) => k.id === c.corretorId);
  const processos = b.processos.filter((p) => p.clienteId === c.id);
  const endereco = [c.endereco, c.numero && `nº ${c.numero}`, c.bairro].filter(Boolean).join(', ');

  const mudar = (fn: (x: Cliente) => void) => alterar((db) => { const x = db.clientes.find((y) => y.id === c.id); if (x) fn(x); });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(dossieTexto(b, c, h));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { alert('Não foi possível copiar. Use Imprimir / PDF.'); }
  };
  const imprimir = () => { if (!imprimirDocumento(`Dossiê — ${c.nome}`, dossieHtml(b, c, h))) alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.'); };

  const addDoc = () => {
    const nome = novoDoc.trim();
    if (!nome) return;
    mudar((x) => { x.documentos = [...(x.documentos ?? []), { id: novoId(), nome, entregue: false }]; });
    setNovoDoc('');
  };
  const addNota = () => {
    const texto = nota.texto.trim();
    if (!texto) return;
    mudar((x) => { x.anotacoes = [...(x.anotacoes ?? []), { id: novoId(), data: nota.data || h, usuarioId: eu?.id ?? '', texto }]; });
    setNota({ data: h, texto: '' });
  };

  const dado = (rotulo: string, valor?: string | null, mono = false) => (
    <div><dt>{rotulo}</dt><dd className={mono ? 'mono' : ''}>{valor || <span className="sem-dado">Não informado</span>}</dd></div>
  );

  return (
    <>
      <button className="btn fantasma pequeno voltar" onClick={aoVoltar}><Icone nome="seta-esq" tamanho={15} />Clientes</button>
      <Topo titulo={c.nome} subtitulo={[c.cpf && `CPF ${formatarCpf(c.cpf)}`, `Cliente desde ${formatar(c.criadoEm)}`].filter(Boolean).join(' · ')}>
        <button className="btn" onClick={copiar}><Icone nome={copiado ? 'concluir' : 'detalhe'} tamanho={16} />{copiado ? 'Copiado' : 'Copiar dossiê'}</button>
        <button className="btn" onClick={imprimir}><Icone nome="imprimir" tamanho={16} />Imprimir / PDF</button>
        <button className="btn primario" onClick={() => setEditando(true)}><Icone nome="editar" tamanho={16} />Editar cadastro</button>
      </Topo>

      <div className="grade dossie">
        <div className="grade" style={{ gap: 16 }}>
          <div className="cartao">
            <h3>Dados do cliente</h3>
            <dl className="dossie-dados">
              {dado('CPF', c.cpf ? formatarCpf(c.cpf) : '', true)}
              {dado('RG', c.rg)}
              {dado('Data de nascimento', c.nascimento ? `${formatar(c.nascimento)}${analise ? ` · ${analise.idade} anos` : ''}` : '')}
              {dado('Sexo', c.sexo === 'F' ? 'Feminino' : c.sexo === 'M' ? 'Masculino' : '')}
              {dado('Estado civil', c.estadoCivil)}
              {dado('Profissão', c.profissao)}
              {dado('Telefone / WhatsApp', c.telefone)}
              {dado('E-mail', c.email)}
              <div className="span-2">{dado('Endereço', endereco)}</div>
              {dado('Cidade', [c.cidade, c.uf].filter(Boolean).join(' - '))}
              {dado('CEP', c.cep)}
            </dl>
            {c.obs && <div className="dossie-obs"><span className="rotulo-campo">Observações gerais</span><p>{c.obs}</p></div>}
          </div>

          <div className="cartao">
            <div className="cartao-cab"><h3>Anotações</h3><span className="mudo">{anotacoes.length}</span></div>
            <div className="nota-nova">
              <textarea rows={2} value={nota.texto} onChange={(e) => setNota({ ...nota, texto: e.target.value })} placeholder="Ex.: Cliente ainda não tem idade para requerer; retornar em maio de 2027." aria-label="Nova anotação" />
              <div className="nota-nova-acoes">
                <input type="date" value={nota.data} max={h} onChange={(e) => setNota({ ...nota, data: e.target.value })} aria-label="Data da anotação" />
                <button className="btn" onClick={addNota} disabled={!nota.texto.trim()}>Adicionar anotação</button>
              </div>
            </div>
            {anotacoes.length === 0 ? <Vazio>Nenhuma anotação ainda.</Vazio> : (
              <ul className="anotacoes">
                {anotacoes.map((a) => (
                  <li key={a.id}>
                    <div className="anotacao-cab">
                      <span className="num">{formatar(a.data)}</span>
                      <span>{nomeUsuario(b, a.usuarioId)}</span>
                      {(a.usuarioId === eu?.id || eu?.papel === 'advogado') && (
                        <button className="icone-btn" title="Excluir anotação" aria-label="Excluir anotação" onClick={() => confirm('Excluir esta anotação?') && mudar((x) => { x.anotacoes = (x.anotacoes ?? []).filter((y) => y.id !== a.id); })}>
                          <Icone nome="lixeira" tamanho={14} />
                        </button>
                      )}
                    </div>
                    <p>{a.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grade" style={{ gap: 16, alignContent: 'start' }}>
          <div className="cartao">
            <h3>Benefício pretendido</h3>
            <div className="beneficio-nome">{c.beneficio ? BENEFICIOS[c.beneficio].rotulo : <span className="sem-dado">Não informado</span>}</div>
            {analise && analise.situacao !== 'sem-requisito' && (
              <div className={`analise-idade ${analise.situacao}`}>
                <span className="situacao"><i />{analise.situacao === 'atingiu' ? 'Tem a idade mínima' : analise.situacao === 'falta' ? 'Ainda sem idade' : 'Falta o sexo'}</span>
                <p>{analise.texto}</p>
              </div>
            )}
            {!c.nascimento && c.beneficio && <p className="mudo" style={{ margin: '10px 0 0' }}>Informe a data de nascimento para calcular a idade mínima.</p>}
          </div>

          <div className="cartao">
            <div className="cartao-cab">
              <h3>Documentos que estão faltando</h3>
              {docs.length > 0 && <span className="mudo num">{docs.length - faltam.length} de {docs.length}</span>}
            </div>
            {docs.length > 0 && <div className="medidor" style={{ marginBottom: 12 }}><span style={{ width: `${((docs.length - faltam.length) / docs.length) * 100}%` }} /></div>}
            {docs.length === 0 ? (
              <div className="grade" style={{ gap: 10, justifyItems: 'start' }}>
                <Vazio>Nenhum documento na lista.</Vazio>
                {c.beneficio && BENEFICIOS[c.beneficio].documentos.length > 0 && (
                  <button className="btn pequeno" onClick={() => mudar((x) => { x.documentos = documentosPadrao(c.beneficio, novoId); })}>
                    Usar a lista padrão de {BENEFICIOS[c.beneficio].rotulo.toLowerCase()}
                  </button>
                )}
              </div>
            ) : (
              <ul className="checklist">
                {[...faltam, ...docs.filter((d) => d.entregue)].map((d) => (
                  <li key={d.id} className={d.entregue ? 'entregue' : ''}>
                    <label>
                      <input type="checkbox" checked={d.entregue} onChange={() => mudar((x) => { const y = x.documentos?.find((z) => z.id === d.id); if (y) y.entregue = !y.entregue; })} />
                      <span>{d.nome}</span>
                    </label>
                    <button className="icone-btn" title="Tirar da lista" aria-label={`Tirar ${d.nome} da lista`} onClick={() => mudar((x) => { x.documentos = (x.documentos ?? []).filter((y) => y.id !== d.id); })}>
                      <Icone nome="lixeira" tamanho={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="doc-novo">
              <input value={novoDoc} onChange={(e) => setNovoDoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDoc()} placeholder="Adicionar documento" aria-label="Novo documento" />
              <button className="btn" onClick={addDoc} disabled={!novoDoc.trim()}>Adicionar</button>
            </div>
          </div>

          <EmailDoCliente c={c} />

          <div className="cartao">
            <h3>Corretor e responsável</h3>
            <dl className="dossie-dados uma">
              <div><dt>Corretor</dt><dd>{corretor ? <>{corretor.nome}{corretor.telefone && <span className="mudo"> · {corretor.telefone}</span>}</> : <span className="sem-dado">Sem corretor</span>}</dd></div>
              <div><dt>Responsável no escritório</dt><dd>{c.responsavelId ? nomeUsuario(b, c.responsavelId) : <span className="sem-dado">Não definido</span>}</dd></div>
            </dl>
          </div>

          {processos.length > 0 && (
            <div className="cartao">
              <div className="cartao-cab"><h3>Processos</h3><span className="mudo">{processos.length}</span></div>
              <ul className="lista">
                {processos.map((p) => (
                  <li key={p.id}><Link to={`/processos/${p.id}`} className="mono">{p.numero}</Link><span className="mudo">{p.assunto}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {editando && <FormCliente cliente={c} aoFechar={() => setEditando(false)} />}
    </>
  );
}
