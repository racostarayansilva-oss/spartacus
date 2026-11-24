// Telas de acesso: login, nova senha, aguardando liberação, carregando e erro.
import { FormEvent, KeyboardEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Campo } from '../components/ui';
import { criarConta, definirNovaSenha, enviarRecuperacao, entrar, sair } from '../nuvem';
import { nomeExibido, PRODUTO, useMarca } from '../marca';
import '../inicio.css';

function Moldura({ titulo, subtitulo, voltar, children }: { titulo: string; subtitulo?: string; voltar?: boolean; children: ReactNode }) {
  const { marca, escritorio } = useMarca();
  return (
    <div className="acesso">
      <div className="acesso-coluna">
        {voltar && <Link to="/" className="acesso-voltar">← Voltar ao início</Link>}
        <div className="acesso-cartao">
          <div className="acesso-marca">
            <img src={marca.logo || '/logo.svg'} alt={nomeExibido(marca)} />
            {escritorio && <span className="acesso-escritorio">{marca.nome}</span>}
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {children}
        </div>
        <p className="acesso-rodape">{escritorio ? `${marca.nome} · acesso restrito à equipe · ${PRODUTO}` : `${PRODUTO} · software jurídico`}</p>
      </div>
    </div>
  );
}

/** Campo de senha com "Mostrar" e aviso de Caps Lock ligado. */
function CampoSenha({ valor, aoMudar, novo = false, foco = false }: { valor: string; aoMudar: (v: string) => void; novo?: boolean; foco?: boolean }) {
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);
  const checar = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <Campo rotulo={novo ? 'Nova senha' : 'Senha'}>
      <div className="acesso-senha">
        <input type={ver ? 'text' : 'password'} autoComplete={novo ? 'new-password' : 'current-password'} value={valor}
          onChange={(e) => aoMudar(e.target.value)} onKeyUp={checar} onKeyDown={checar} required autoFocus={foco} />
        <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>{ver ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {caps && <span className="acesso-dica">Caps Lock está ligado.</span>}
    </Campo>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'aviso'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [primeiro, setPrimeiro] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      if (primeiro) {
        if (senha.length < 8) throw new Error('Use pelo menos 8 caracteres na senha.');
        const entrou = await criarConta(email.trim(), senha);
        if (!entrou) {
          setMsg({ tipo: 'aviso', texto: `Enviamos para ${email.trim()} um link de confirmação. Abra o link e depois entre com a senha que você criou.` });
          setEnviando(false);
        }
        return;
      }
      await entrar(email.trim(), senha);
    } catch (er: any) {
      setMsg({ tipo: 'erro', texto: er.message });
      setEnviando(false);
    }
  };

  const esqueci = async () => {
    if (!email.trim()) return setMsg({ tipo: 'erro', texto: 'Digite seu e-mail acima e clique de novo em “Esqueci a senha”.' });
    try {
      await enviarRecuperacao(email.trim());
      setMsg({ tipo: 'aviso', texto: `Enviamos para ${email.trim()} um link para criar uma nova senha. Confira também a caixa de spam.` });
    } catch (er: any) {
      setMsg({ tipo: 'erro', texto: er.message });
    }
  };

  return (
    <Moldura titulo={primeiro ? 'Primeiro acesso' : 'Entrar'} subtitulo={primeiro ? 'Use o e-mail que o escritório liberou para você e crie sua senha.' : 'Use o e-mail e a senha cadastrados pelo escritório.'} voltar>
      <form onSubmit={enviar}>
        <Campo rotulo="E-mail"><input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Campo>
        <CampoSenha valor={senha} aoMudar={setSenha} novo={primeiro} />
        {msg && <div className={msg.tipo} role={msg.tipo === 'erro' ? 'alert' : 'status'}>{msg.texto}</div>}
        <button className="pub-btn pub-btn-primario" type="submit" disabled={enviando}>{enviando ? (primeiro ? 'Criando…' : 'Entrando…') : (primeiro ? 'Criar senha e entrar' : 'Entrar')}</button>
        {!primeiro && <button className="acesso-link" type="button" onClick={esqueci}>Esqueci a senha</button>}
        <button className="acesso-link" type="button" onClick={() => { setPrimeiro(!primeiro); setMsg(null); }}>
          {primeiro ? 'Já tenho senha' : 'Primeiro acesso? Criar senha'}
        </button>
      </form>
    </Moldura>
  );
}

export function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.');
    setSalvando(true);
    try {
      await definirNovaSenha(senha);
    } catch (er: any) {
      setErro(er.message);
      setSalvando(false);
    }
  };
  return (
    <Moldura titulo="Nova senha" subtitulo="Escolha uma senha com pelo menos 8 caracteres.">
      <form onSubmit={salvar}>
        <CampoSenha valor={senha} aoMudar={setSenha} novo foco />
        {erro && <div className="erro" role="alert">{erro}</div>}
        <button className="pub-btn pub-btn-primario" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e entrar'}</button>
      </form>
    </Moldura>
  );
}

export function AguardandoLiberacao({ email }: { email?: string }) {
  return (
    <Moldura titulo="Quase lá" subtitulo="Seu acesso ainda não foi liberado.">
      <p className="mudo" style={{ margin: 0, textAlign: 'center' }}>
        O login {email ? <strong>{email}</strong> : ''} existe, mas ainda não está ligado a um escritório ativo. Peça ao administrador do escritório para liberar este e-mail em Configurações → Equipe e acessos.
      </p>
      <button className="acesso-link" onClick={() => sair()}>Sair</button>
    </Moldura>
  );
}

export function Carregando() {
  return (
    <Moldura titulo="Carregando" subtitulo="Buscando os dados do escritório…">
      <div className="barra" aria-hidden="true"><span style={{ width: '40%' }} /></div>
    </Moldura>
  );
}

export function ErroNuvem({ erro }: { erro?: string }) {
  return (
    <Moldura titulo="Não foi possível carregar">
      <div className="erro" role="alert">{erro}</div>
      <p className="mudo" style={{ margin: 0 }}>Se for a primeira vez, confira se o arquivo supabase/schema.sql foi executado no SQL Editor do Supabase.</p>
      <button className="pub-btn pub-btn-primario" onClick={() => window.location.reload()}>Tentar de novo</button>
      <button className="acesso-link" onClick={() => sair()}>Sair</button>
    </Moldura>
  );
}

export function OutroEscritorio({ email }: { email?: string }) {
  const { marca } = useMarca();
  return (
    <Moldura titulo="Endereço de outro escritório" subtitulo={`Este é o acesso de ${marca.nome}.`}>
      <p className="mudo" style={{ margin: 0, textAlign: 'center' }}>
        O login {email ? <strong>{email}</strong> : ''} pertence a outro escritório. Entre pelo endereço do seu escritório.
      </p>
      <button className="acesso-link" onClick={() => sair()}>Sair</button>
    </Moldura>
  );
}
