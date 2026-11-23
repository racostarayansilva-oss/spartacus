import { useEffect, useState } from 'react';
import { alterar, Corretor, exportarJson, importarJson, MODO_NUVEM, novoId, Papel, restaurarExemplo, useBanco, usuarioAtual } from '../store';
import { alterarPerfil, listarPerfis, Perfil, PapelPerfil } from '../nuvem';
import { cpfValido } from '../lib/cpf';

const ROTULO_PAPEL: Record<PapelPerfil, string> = {
  pendente: 'Aguardando liberação', advogado: 'Advogado (administrador)', equipe: 'Equipe', cliente: 'Cliente', bloqueado: 'Bloqueado',
};

/** Logins do Supabase: o advogado libera, muda o papel ou bloqueia. */
function EquipeNuvem() {
  const b = useBanco();
  const souAdvogado = usuarioAtual(b)?.papel === 'advogado';
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [erro, setErro] = useState('');
  const carregar = () => listarPerfis().then(setPerfis).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const mudar = async (p: Perfil, m: Partial<Perfil>) => {
    setErro('');
    if (m.papel && p.auth_id === b.config.usuarioAtualId && m.papel !== 'advogado') {
      if (!confirm('Você vai tirar o seu próprio acesso de administrador. Continuar?')) return;
    }
    if (m.cpf && !cpfValido(m.cpf)) return setErro('CPF inválido.');
    try { await alterarPerfil(p.auth_id, m); await carregar(); } catch (e: any) { setErro(e.message); }
  };

  return (
    <div className="cartao">
      <h3>Equipe e acessos</h3>
      <p className="mudo" style={{ marginTop: 0 }}>
        Para dar acesso a alguém: no Supabase, vá em Authentication → Users → Add user (marque “Auto Confirm User”). A pessoa aparece aqui como “Aguardando liberação”.
      </p>
      {erro && <div className="erro">{erro}</div>}
      <ul className="lista">
        {perfis.map((p) => (
          <li key={p.auth_id} style={{ flexWrap: 'wrap' }}>
            <span style={{ minWidth: 180, flex: 1 }}>
              {souAdvogado ? (
                <input defaultValue={p.nome} onBlur={(e) => e.target.value !== p.nome && mudar(p, { nome: e.target.value })} aria-label="Nome" />
              ) : <strong>{p.nome}</strong>}
              <div className="mudo">{p.email}</div>
              {p.papel === 'cliente' && souAdvogado && (
                <input placeholder="CPF do cliente" defaultValue={p.cpf || ''} onBlur={(e) => mudar(p, { cpf: e.target.value.replace(/\D/g, '') })} style={{ marginTop: 4 }} />
              )}
            </span>
            {souAdvogado ? (
              <select value={p.papel} onChange={(e) => mudar(p, { papel: e.target.value as PapelPerfil })} style={{ width: 'auto' }}>
                {Object.entries(ROTULO_PAPEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            ) : (
              <span className={`etiqueta ${p.papel === 'pendente' ? 'ambar' : ''}`}>{ROTULO_PAPEL[p.papel]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
import { formatar } from '../lib/datas';
import { gerarChaveEmails } from '../nuvem';
import { codigoWorker, limparDominio } from '../lib/emailCliente';

/** Administrador: domínio dos e-mails gerados e o passo a passo do Cloudflare para recebê-los. */
function EmailsClientesConfig() {
  const b = useBanco();
  const [dominio, setDominio] = useState(b.config.dominioEmails ?? '');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const limpo = limparDominio(dominio);
  const mudou = limpo !== (b.config.dominioEmails ?? '');
  const comEmail = b.clientes.filter((c) => c.emailGerado).length;

  const salvarDominio = () => {
    setErro('');
    if (!limpo) return setErro('Domínio inválido. Exemplo: clientes.seuescritorio.adv.br');
    if (comEmail && b.config.dominioEmails && !confirm(`${comEmail} cliente(s) já têm e-mail em @${b.config.dominioEmails}. Eles continuam com o endereço antigo; só os novos usarão @${limpo}. Continuar?`)) return;
    alterar((db) => { db.config.dominioEmails = limpo; });
    setDominio(limpo);
  };
  const gerar = async () => {
    setErro('');
    if (codigo && !confirm('Gerar outra chave desliga a anterior: o Worker do Cloudflare terá de ser atualizado com o código novo. Continuar?')) return;
    try {
      const chave = await gerarChaveEmails();
      setCodigo(codigoWorker(`${window.location.origin}/api/email/entrada`, chave));
    } catch (e: any) { setErro(e.message); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { setErro('Não foi possível copiar. Selecione o código e copie com Ctrl+C.'); }
  };

  return (
    <div className="cartao grade" style={{ gap: 12, alignContent: 'start' }}>
      <h3>E-mails dos clientes</h3>
      <p className="mudo" style={{ margin: 0 }}>
        Cada cliente pode ganhar um e-mail (ex.: maria.souza.k3f9@{limpo || 'clientes.seuescritorio.adv.br'}) para o cadastro no gov.br e no Meu INSS. As mensagens chegam em E-mails dos clientes.
      </p>
      <div className="linha-campos" style={{ alignItems: 'end' }}>
        <Campo rotulo="Domínio dos e-mails"><input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="clientes.seuescritorio.adv.br" className="mono" /></Campo>
        <button className="btn" onClick={salvarDominio} disabled={!mudou}>Salvar domínio</button>
      </div>
      {erro && <div className="erro">{erro}</div>}
      {MODO_NUVEM ? (
        <details className="passo-a-passo">
          <summary>Como ligar a recepção (Cloudflare, gratuito)</summary>
          <ol>
            <li>O domínio (ou o domínio principal do subdomínio) precisa estar no Cloudflare.</li>
            <li>No Cloudflare: <b>Email → Email Routing</b> → ative para o domínio acima (ele cria os registros MX).</li>
            <li>Clique em <b>Gerar chave e código</b> aqui embaixo e copie o código.</li>
            <li>No Cloudflare: <b>Workers &amp; Pages → Create → Worker</b>, dê o nome <span className="mono">ra-connect-emails</span>, apague o código de exemplo, cole o copiado e clique em <b>Deploy</b>.</li>
            <li>Volte em <b>Email Routing → Routing rules → Catch-all address</b>: ação <b>Send to a Worker</b>, escolha <span className="mono">ra-connect-emails</span> e ative.</li>
            <li>Teste: gere o e-mail de um cliente, mande uma mensagem para ele e veja em E-mails dos clientes.</li>
          </ol>
          <button className="btn" onClick={gerar}><Icone nome="chave" tamanho={15} />{codigo ? 'Gerar outra chave' : 'Gerar chave e código'}</button>
          {codigo && (
            <div className="codigo-worker">
              <div className="flex entre"><span className="mudo">Código do Worker (contém a chave: não compartilhe)</span><button className="btn pequeno" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar código'}</button></div>
              <pre className="mono">{codigo}</pre>
            </div>
          )}
        </details>
      ) : (
        <p className="mudo" style={{ margin: 0 }}>No modo de testes os endereços são gerados, mas a recepção só funciona com o banco na nuvem (Supabase).</p>
      )}
    </div>
  );
}
import { Campo, Segmentos, Topo } from '../components/ui';
import { Icone } from '../components/icones';
import { EscopoFeriado } from '../lib/prazos';

export default function Configuracoes() {
  const b = useBanco();
  const [fer, setFer] = useState({ data: '', nome: '', escopo: 'municipal' as EscopoFeriado });
  const [usu, setUsu] = useState({ nome: '', papel: 'equipe' as Papel, cpf: '' });
  const [cor, setCor] = useState({ nome: '', telefone: '', regioes: '' });
  const [msg, setMsg] = useState('');

  const baixar = () => {
    const blob = new Blob([exportarJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ra-connect-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <>
      <Topo titulo="Configurações" />
      <div className="grade g2">
        <div className="cartao grade" style={{ gap: 12 }}>
          <h3>Escritório</h3>
          <Campo rotulo="Nome usado na assinatura das respostas"><input value={b.config.nomeEscritorio} onChange={(e) => alterar((db) => { db.config.nomeEscritorio = e.target.value; })} /></Campo>
          <div className="flex">
            <span className="mudo">Tema</span>
            <Segmentos valor={b.config.tema} aoMudar={(v) => alterar((db) => { db.config.tema = v; })} opcoes={[['sistema', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']]} />
          </div>
          <div className="flex">
            <span className="mudo">Plano</span>
            <Segmentos valor={b.config.plano} aoMudar={(v) => alterar((db) => { db.config.plano = v; })} opcoes={[['essencial', 'Essencial'], ['diamante', 'Diamante']]} />
          </div>
          <div>
            <span className="mudo">OABs monitoradas no DJEN (inscrição suplementar com a letra, ex.: 30733A)</span>
            <ul className="lista">
              {b.config.oabs.map((o, i) => (
                <li key={i}>
                  <span className="flex" style={{ flex: 1 }}>
                    <input value={o.uf} maxLength={2} style={{ width: 60 }} aria-label="UF"
                      onChange={(e) => alterar((db) => { db.config.oabs[i].uf = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); })} />
                    <input value={o.numero} style={{ width: 120 }} className="mono" aria-label="Número"
                      onChange={(e) => alterar((db) => { db.config.oabs[i].numero = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''); })} />
                  </span>
                  <button className="btn pequeno perigo" onClick={() => alterar((db) => { db.config.oabs.splice(i, 1); })} aria-label="Remover OAB">✕</button>
                </li>
              ))}
            </ul>
            <button className="btn pequeno" onClick={() => alterar((db) => { db.config.oabs.push({ numero: '', uf: 'MA' }); })}>+ OAB</button>
          </div>
        </div>

        <div className="cartao">
          <h3>Feriados locais e suspensões</h3>
          <p className="mudo" style={{ marginTop: 0 }}>Cadastre feriados municipais (São Luís, Tomé-Açu, Breves) e suspensões de expediente. Eles entram no cálculo de prazos.</p>
          <div className="linha-campos" style={{ alignItems: 'end' }}>
            <Campo rotulo="Data"><input type="date" value={fer.data} onChange={(e) => setFer({ ...fer, data: e.target.value })} /></Campo>
            <Campo rotulo="Nome"><input value={fer.nome} onChange={(e) => setFer({ ...fer, nome: e.target.value })} placeholder="Aniversário de Breves" /></Campo>
            <Campo rotulo="Escopo">
              <select value={fer.escopo} onChange={(e) => setFer({ ...fer, escopo: e.target.value as EscopoFeriado })}>
                <option value="municipal">Municipal</option><option value="MA">MA</option><option value="PA">PA</option><option value="forense">Suspensão do tribunal</option>
              </select>
            </Campo>
            <button className="btn" onClick={() => { if (!fer.data || !fer.nome) return; alterar((db) => { db.config.feriadosExtras.push({ ...fer }); }); setFer({ ...fer, data: '', nome: '' }); }}>Adicionar</button>
          </div>
          <ul className="lista mt">
            {b.config.feriadosExtras.map((f, i) => (
              <li key={i}><span><span className="num">{formatar(f.data)}</span> {f.nome} <span className="etiqueta">{f.escopo}</span></span>
                <button className="btn pequeno perigo" onClick={() => alterar((db) => { db.config.feriadosExtras.splice(i, 1); })}>✕</button></li>
            ))}
          </ul>
        </div>

        {MODO_NUVEM ? <EquipeNuvem /> : <div className="cartao">
          <h3>Equipe</h3>
          <ul className="lista">{b.usuarios.map((u) => <li key={u.id}><span>{u.nome}</span><span className="etiqueta">{u.papel}</span></li>)}</ul>
          <div className="linha-campos mt" style={{ alignItems: 'end' }}>
            <Campo rotulo="Nome"><input value={usu.nome} onChange={(e) => setUsu({ ...usu, nome: e.target.value })} /></Campo>
            <Campo rotulo="Papel"><select value={usu.papel} onChange={(e) => setUsu({ ...usu, papel: e.target.value as Papel })}><option value="equipe">Equipe</option><option value="advogado">Advogado</option><option value="cliente">Cliente</option></select></Campo>
            {usu.papel === 'cliente' && <Campo rotulo="CPF"><input value={usu.cpf} onChange={(e) => setUsu({ ...usu, cpf: e.target.value.replace(/\D/g, '') })} /></Campo>}
            <button className="btn" onClick={() => { if (!usu.nome) return; alterar((db) => { db.usuarios.push({ id: novoId(), ...usu }); }); setUsu({ nome: '', papel: 'equipe', cpf: '' }); }}>Adicionar</button>
          </div>
        </div>}

        {usuarioAtual(b)?.papel === 'advogado' && <EmailsClientesConfig />}

        <div className="cartao">
          <h3>Corretores parceiros</h3>
          <ul className="lista">{b.corretores.map((k: Corretor) => <li key={k.id}><span>{k.nome}<div className="mudo">{k.regioes.join(', ')}</div></span><span className="num mudo">{k.telefone}</span></li>)}</ul>
          <div className="linha-campos mt" style={{ alignItems: 'end' }}>
            <Campo rotulo="Nome"><input value={cor.nome} onChange={(e) => setCor({ ...cor, nome: e.target.value })} /></Campo>
            <Campo rotulo="Telefone"><input value={cor.telefone} onChange={(e) => setCor({ ...cor, telefone: e.target.value })} /></Campo>
            <Campo rotulo="Regiões (vírgula)"><input value={cor.regioes} onChange={(e) => setCor({ ...cor, regioes: e.target.value })} /></Campo>
            <button className="btn" onClick={() => { if (!cor.nome) return; alterar((db) => { db.corretores.push({ id: novoId(), nome: cor.nome, telefone: cor.telefone, regioes: cor.regioes.split(',').map((s) => s.trim()).filter(Boolean) }); }); setCor({ nome: '', telefone: '', regioes: '' }); }}>Adicionar</button>
          </div>
        </div>

        <div className="cartao">
          <h3>Dados</h3>
          <p className="mudo" style={{ marginTop: 0 }}>
            {MODO_NUVEM
              ? 'Os dados ficam no banco do escritório (Supabase), com backup diário no plano Pro. Importar um backup substitui os dados atuais da equipe.'
              : 'Modo de testes: os dados ficam só neste navegador. Faça backup com frequência.'}
          </p>
          <div className="flex">
            <button className="btn" onClick={baixar}>Baixar backup</button>
            <label className="btn">Importar backup
              <input type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (MODO_NUVEM && !confirm('Substituir os dados da equipe pelos do arquivo?')) return;
                try { importarJson(await f.text()); setMsg('Backup importado.'); } catch (er: any) { setMsg(er.message); }
              }} />
            </label>
            {!MODO_NUVEM && <button className="btn perigo" onClick={() => { if (confirm('Apagar tudo e voltar aos dados de exemplo?')) restaurarExemplo(); }}>Restaurar dados de exemplo</button>}
          </div>
          {msg && <p className="mudo">{msg}</p>}
        </div>
      </div>
    </>
  );
}
