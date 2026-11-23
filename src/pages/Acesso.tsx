// Telas de acesso: login, nova senha, aguardando liberação, carregando e erro.
import { FormEvent, KeyboardEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Campo } from '../components/ui';
import { definirNovaSenha, enviarRecuperacao, entrar, sair } from '../nuvem';
import '../inicio.css';

function Moldura({ titulo, subtitulo, voltar, children }: { titulo: string; subtitulo?: string; voltar?: boolean; children: ReactNode }) {
  return (
    <div className="acesso">
      <div className="acesso-coluna">
        {voltar && <Link to="/" className="acesso-voltar">← Voltar ao início</Link>}
        <div className="acesso-cartao">
          <div className="acesso-marca">
            <img src="/logo.svg" alt="RA Connect" />
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {children}
        </div>
        <p className="acesso-rodape">RA Costa Advocacia &amp; Consultoria · acesso restrito à equipe</p>
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

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
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
    <Moldura titulo="Entrar" subtitulo="Use o e-mail e a senha cadastrados pelo escritório." voltar>
      <form onSubmit={enviar}>
        <Campo rotulo="E-mail"><input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Campo>
        <CampoSenha valor={senha} aoMudar={setSenha} />
        {msg && <div className={msg.tipo} role={msg.tipo === 'erro' ? 'alert' : 'status'}>{msg.texto}</div>}
        <button className="pub-btn pub-btn-primario" type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <button className="acesso-link" type="button" onClick={esqueci}>Esqueci a senha</button>
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
        O login {email ? <strong>{email}</strong> : ''} foi criado. Peça ao administrador do escritório para liberar em Configurações → Equipe e acessos.
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
