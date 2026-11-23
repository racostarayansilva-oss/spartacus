import { useEffect, useRef } from 'react';
import { aplicarMigracoes, migracoesPendentes } from './migracoes';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Inicio from './pages/Inicio';
import { Icone, Logo } from './components/icones';
import { alterar, MODO_NUVEM, useBanco, usuarioAtual } from './store';
import { sair, useNuvem } from './nuvem';
import { AguardandoLiberacao, Carregando, ErroNuvem, Login, NovaSenha } from './pages/Acesso';
import Painel from './pages/Painel';
import WhatsApp from './pages/WhatsApp';
import Controladoria from './pages/Controladoria';
import Agenda from './pages/Agenda';
import Processos from './pages/Processos';
import FichaProcesso from './pages/FichaProcesso';
import Tarefas from './pages/Tarefas';
import Clientes from './pages/Clientes';
import Financeiro from './pages/Financeiro';
import Normas from './pages/Normas';
import DecisoesCpf from './pages/DecisoesCpf';
import Integracoes from './pages/Integracoes';
import Configuracoes from './pages/Configuracoes';
import Crm from './pages/Crm';
import Documentos from './pages/Documentos';
import RaSpeak from './pages/RaSpeak';
import Producao from './pages/Producao';
import AreaTrabalho from './pages/AreaTrabalho';
import FerramentaPdf from './pages/FerramentaPdf';
import IndicadoresCnis from './pages/IndicadoresCnis';
import EmailsClientes from './pages/EmailsClientes';
import DiretorioSenhas from './pages/DiretorioSenhas';
import { SinoNotificacoes } from './components/Notificacoes';

const MENU: [string, string, string][] = [
  ['/', 'Área de trabalho', 'inicio'],
  ['/painel', 'Painel', 'painel'],
  ['/whatsapp', 'WhatsApp', 'whatsapp'],
  ['/controladoria', 'Controladoria', 'controladoria'],
  ['/agenda', 'Prazos e agenda', 'agenda'],
  ['/processos', 'Processos', 'processos'],
  ['/tarefas', 'Tarefas', 'tarefas'],
  ['/clientes', 'Clientes', 'clientes'],
  ['/emails', 'E-mails dos clientes', 'email'],
  ['/documentos', 'Documentos', 'documentos'],
  ['/ra-speak', 'RA Speak', 'speak'],
  ['/producao', 'Produção', 'producao'],
  ['/financeiro', 'Financeiro', 'financeiro'],
  ['/normas', 'Normas', 'normas'],
  ['/cpf', 'Decisões por CPF', 'cpf'],
  ['/integracoes', 'Integrações', 'integracoes'],
  ['/senhas', 'Diretório de senhas', 'chave'],
  ['/crm', 'CRM', 'crm'],
  ['/config', 'Configurações', 'config'],
];

// No celular a barra de baixo mostra só os módulos mais usados; o restante fica na Área de trabalho.
const MENU_MOVEL = ['/', '/painel', '/whatsapp', '/controladoria', '/processos', '/tarefas', '/agenda', '/clientes', '/emails', '/documentos', '/ra-speak', '/producao', '/financeiro', '/normas', '/cpf', '/integracoes', '/crm', '/config'];

export default function App() {
  const n = useNuvem();
  const { pathname } = useLocation();
  // Página inicial pública: em /inicio sempre (inclusive logado e no modo de testes)
  if (pathname === '/inicio') return <Inicio destinoEntrar="/" logado={!MODO_NUVEM || n.fase === 'pronto'} />;
  if (MODO_NUVEM) {
    if (n.fase === 'carregando') return <Carregando />;
    if (n.fase === 'login') {
      // Sem login: "/" mostra a página inicial e "/entrar" o formulário.
      // Qualquer outro endereço (link direto, sessão expirada) vai direto ao login e, depois de entrar, abre aquela página.
      if (pathname === '/') return <Inicio destinoEntrar="/entrar" />;
      return <Login />;
    }
    if (n.fase === 'novaSenha') return <NovaSenha />;
    if (n.fase === 'pendente') return <AguardandoLiberacao email={n.perfil?.email} />;
    if (n.fase === 'erro') return <ErroNuvem erro={n.erro} />;
  }
  return <Aplicativo />;
}

function Aplicativo() {
  const b = useBanco();
  const n = useNuvem();

  // Correções de dados pendentes (rodam uma vez, já com os dados do banco carregados)
  const migrou = useRef(false);
  useEffect(() => {
    if (migrou.current || !migracoesPendentes(b).length) return;
    migrou.current = true;
    alterar(aplicarMigracoes);
  }, [b]);

  useEffect(() => {
    const raiz = document.documentElement;
    if (b.config.tema === 'claro') raiz.dataset.theme = 'light';
    else if (b.config.tema === 'escuro') raiz.dataset.theme = 'dark';
    else raiz.dataset.theme = 'system';
  }, [b.config.tema]);

  // Integrações (status e testes das APIs) só para a conta de administrador
  const administrador = usuarioAtual(b)?.papel === 'advogado';
  const menu = MENU.filter(([to]) => (to !== '/integracoes' && to !== '/senhas') || administrador);

  return (
    <div className="app">
      <aside className="lateral">
        <NavLink to="/" className="marca">
          <Logo />
          <span className="marca-texto">
            <b>R<span>A</span> CONNECT</b>
            <small>SOFTWARE JURÍDICO</small>
          </span>
        </NavLink>
        <SinoNotificacoes />
        <nav className="nav">
          {menu.map(([to, rotulo, icone]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'ativo' : '')}>
              <Icone nome={icone} />
              {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
          {MODO_NUVEM ? (
            <>
              <div style={{ color: '#e4e4ee' }}>{usuarioAtual(b)?.nome}</div>
              <div title={n.syncErro}>
                {n.sync === 'salvando' ? 'Salvando…' : n.sync === 'erro' ? <span style={{ color: '#ff8a80' }}>Erro ao salvar</span> : 'Tudo salvo'}
              </div>
              <button className="btn pequeno" style={{ marginTop: 8 }} onClick={() => sair()}>Sair</button>
            </>
          ) : (
            <label className="campo" style={{ color: '#9a9ab0' }}>
              Usuário (modo de testes)
              <select
                value={b.config.usuarioAtualId}
                onChange={(e) => alterar((db) => { db.config.usuarioAtualId = e.target.value; })}
              >
                {b.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
          <p style={{ marginTop: 10 }}>Plano {b.config.plano === 'diamante' ? 'Diamante' : 'Essencial'}</p>
        </div>
      </aside>

      <main className="principal">
        {n.sync === 'erro' && (
          <div className="erro" style={{ marginBottom: 12 }}>
            Uma alteração não foi salva no banco ({n.syncErro}). Recarregue a página antes de continuar.
          </div>
        )}
        <Routes>
          <Route path="/" element={<AreaTrabalho />} />
          <Route path="/painel" element={<Painel />} />
          <Route path="/ferramentas/cnis" element={<IndicadoresCnis />} />
          <Route path="/ferramentas/comprimir" element={<FerramentaPdf key="comprimir" tipo="comprimir" />} />
          <Route path="/ferramentas/dividir" element={<FerramentaPdf key="dividir" tipo="dividir" />} />
          <Route path="/ferramentas/imagens" element={<FerramentaPdf key="imagens" tipo="imagens" />} />
          <Route path="/ferramentas/juntar" element={<FerramentaPdf key="juntar" tipo="juntar" />} />
          <Route path="/whatsapp" element={<WhatsApp />} />
          <Route path="/controladoria" element={<Controladoria />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/processos" element={<Processos />} />
          <Route path="/processos/:id" element={<FichaProcesso />} />
          <Route path="/tarefas" element={<Tarefas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/ra-speak" element={<RaSpeak />} />
          <Route path="/producao" element={<Producao />} />
          <Route path="/atividades" element={<Navigate to="/producao" replace />} />
          <Route path="/relatorios" element={<Navigate to="/producao?aba=mensal" replace />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/normas" element={<Normas />} />
          <Route path="/cpf" element={<DecisoesCpf />} />
          <Route path="/integracoes" element={administrador ? <Integracoes /> : <Navigate to="/" replace />} />
          <Route path="/emails" element={<EmailsClientes />} />
          <Route path="/senhas" element={administrador ? <DiretorioSenhas /> : <Navigate to="/" replace />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/config" element={<Configuracoes />} />
          <Route path="/entrar" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="barra-movel" aria-label="Navegação">
        <SinoNotificacoes compacto />
        {menu.filter(([to]) => MENU_MOVEL.includes(to)).map(([to, rotulo, icone]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'ativo' : '')}>
            <Icone nome={icone} />
            {rotulo.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
