// Área de trabalho: porta de entrada com todas as ferramentas em cartões.
// A ordem das ferramentas principais é de cada pessoa e fica salva neste navegador.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banco, useBanco, usuarioAtual } from '../store';
import { formatar, hoje } from '../lib/datas';
import { Icone } from '../components/icones';
import { primeiroNome } from '../lib/notificacoes';

type Selo = 'novo' | number | undefined;
type Ferramenta = { id: string; rota: string; titulo: string; descricao: string; icone: string; selo?: (b: Banco, eu?: string) => Selo; admin?: boolean };

const PRINCIPAIS: Ferramenta[] = [
  { id: 'clientes', rota: '/clientes', titulo: 'Clientes e contatos', descricao: 'Cadastro e dossiê de cada cliente', icone: 'clientes' },
  { id: 'emails', rota: '/emails', titulo: 'E-mails dos clientes', descricao: 'Códigos do gov.br e avisos do Meu INSS no e-mail gerado', icone: 'email', selo: (b) => b.emails.filter((e) => !e.lido).length },
  { id: 'processos', rota: '/processos', titulo: 'Processos', descricao: 'Processos judiciais e administrativos do escritório', icone: 'processos' },
  { id: 'intimacoes', rota: '/controladoria', titulo: 'Publicações e intimações', descricao: 'Cada publicação vira um prazo com responsável', icone: 'controladoria', selo: (b) => b.intimacoes.filter((i) => i.status === 'nova').length },
  { id: 'agenda', rota: '/agenda', titulo: 'Prazos e agenda', descricao: 'Prazos, audiências e compromissos da equipe', icone: 'agenda', selo: (b) => b.compromissos.filter((c) => c.status === 'pendente' && c.data <= hoje()).length },
  { id: 'documentos', rota: '/documentos', titulo: 'Documentos', descricao: 'Robô gerador de procurações, contratos e petições', icone: 'documentos' },
  { id: 'tarefas', rota: '/tarefas', titulo: 'Tarefas', descricao: 'Quadro de tarefas e distribuição da equipe', icone: 'tarefas', selo: (b, eu) => b.tarefas.filter((t) => t.responsavelId === eu && t.coluna !== 'concluido').length },
  { id: 'whatsapp', rota: '/whatsapp', titulo: 'WhatsApp', descricao: 'Classifica pedidos e monta a resposta pronta', icone: 'whatsapp' },
  { id: 'producao', rota: '/producao', titulo: 'Produção e relatórios', descricao: 'Relatório diário, painel mensal e ranking', icone: 'producao' },
  { id: 'financeiro', rota: '/financeiro', titulo: 'Financeiro', descricao: 'Receitas, despesas e valores a receber', icone: 'financeiro' },
  { id: 'painel', rota: '/painel', titulo: 'Painel de indicadores', descricao: 'Entradas, protocolos, audiências e resultados', icone: 'painel' },
];

const OUTRAS: Ferramenta[] = [
  { id: 'cnis', rota: '/ferramentas/cnis', titulo: 'Indicadores do CNIS', descricao: 'O que significa e o que fazer com cada indicador do CNIS', icone: 'cnis', selo: () => 'novo' },
  { id: 'comprimir', rota: '/ferramentas/comprimir', titulo: 'Comprimir PDFs', descricao: 'Reduza o tamanho para enviar ao INSS e ao PJe', icone: 'comprimir', selo: () => 'novo' },
  { id: 'dividir', rota: '/ferramentas/dividir', titulo: 'Dividir PDFs', descricao: 'Divida PDFs por páginas ou por tamanho', icone: 'tesoura', selo: () => 'novo' },
  { id: 'imagens', rota: '/ferramentas/imagens', titulo: 'Converter imagens em PDF', descricao: 'Fotos de documentos (JPG, PNG, WebP) em um PDF', icone: 'imagem', selo: () => 'novo' },
  { id: 'juntar', rota: '/ferramentas/juntar', titulo: 'Juntar PDFs', descricao: 'Junte vários PDFs e imagens em um único arquivo', icone: 'camadas', selo: () => 'novo' },
  { id: 'senhas', rota: '/senhas', titulo: 'Diretório de senhas', descricao: 'Acessos do escritório e dos clientes (só administradores)', icone: 'chave', selo: () => 'novo', admin: true },
  { id: 'normas', rota: '/normas', titulo: 'Normas', descricao: 'Legislação federal pesquisável e fichas do escritório', icone: 'normas' },
  { id: 'cpf', rota: '/cpf', titulo: 'Decisões por CPF', descricao: 'Processos e decisões em que a pessoa é parte', icone: 'cpf' },
  { id: 'speak', rota: '/ra-speak', titulo: 'RA Speak', descricao: 'Fale e ele transcreve; depois pode resumir', icone: 'speak' },
  { id: 'crm', rota: '/crm', titulo: 'CRM', descricao: 'Atendimento e contatos', icone: 'crm' },
];

const chave = (uid: string) => `ra-connect:ordem-ferramentas:${uid}`;

function lerOrdem(uid: string): string[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave(uid)) ?? '[]');
    if (Array.isArray(salvo)) return salvo.filter((x) => typeof x === 'string');
  } catch { /* sem armazenamento: usa a ordem padrão */ }
  return [];
}

function ordenar(ids: string[]) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...PRINCIPAIS].sort((a, b) => (pos.get(a.id) ?? 99 + PRINCIPAIS.indexOf(a)) - (pos.get(b.id) ?? 99 + PRINCIPAIS.indexOf(b)));
}


function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function SeloCartao({ selo }: { selo: Selo }) {
  if (selo === 'novo') return <span className="at-selo novo">Novo</span>;
  if (typeof selo === 'number' && selo > 0) return <span className="at-selo conta num">{selo > 99 ? '99+' : selo}</span>;
  return null;
}

function Cartao({ f, selo, reordenando, mover, primeiro, ultimo }: { f: Ferramenta; selo: Selo; reordenando?: boolean; mover?: (d: -1 | 1) => void; primeiro?: boolean; ultimo?: boolean }) {
  const corpo = (
    <>
      <span className="at-icone"><Icone nome={f.icone} tamanho={20} /></span>
      <span className="at-texto">
        <b>{f.titulo}</b>
        <span>{f.descricao}</span>
      </span>
      {!reordenando && <SeloCartao selo={selo} />}
    </>
  );
  if (reordenando) {
    return (
      <div className="at-cartao reordenando">
        {corpo}
        <span className="at-mover">
          <button className="icone-btn" onClick={() => mover!(-1)} disabled={primeiro} aria-label={`Mover ${f.titulo} para trás`} title="Mover para trás"><Icone nome="seta-esq" tamanho={15} /></button>
          <button className="icone-btn" onClick={() => mover!(1)} disabled={ultimo} aria-label={`Mover ${f.titulo} para frente`} title="Mover para frente"><Icone nome="seta-dir" tamanho={15} /></button>
        </span>
      </div>
    );
  }
  return <Link to={f.rota} className="at-cartao">{corpo}</Link>;
}

export default function AreaTrabalho() {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const uid = eu?.id ?? 'anonimo';
  const [ordem, setOrdem] = useState<string[]>(() => lerOrdem(uid));
  const [reordenando, setReordenando] = useState(false);
  const principais = ordenar(ordem);

  const salvar = (ids: string[]) => {
    setOrdem(ids);
    try { localStorage.setItem(chave(uid), JSON.stringify(ids)); } catch { /* fica só nesta sessão */ }
  };
  const mover = (id: string, d: -1 | 1) => {
    const ids = principais.map((f) => f.id);
    const i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    salvar(ids);
  };

  return (
    <div className="area-trabalho">
      <div className="at-saudacao">
        <h1>{saudacao()}{eu ? `, ${primeiroNome(eu.nome)}` : ''}</h1>
        <p className="subtitulo">{b.config.nomeEscritorio} · {formatar(hoje())}</p>
      </div>

      <section className="at-secao">
        <div className="at-secao-cab">
          <h2>Ferramentas principais</h2>
          {reordenando ? (
            <>
              <button className="btn pequeno primario" onClick={() => setReordenando(false)}>Concluir</button>
              {ordem.length > 0 && <button className="btn pequeno fantasma" onClick={() => salvar([])}>Ordem padrão</button>}
            </>
          ) : (
            <button className="btn pequeno fantasma" onClick={() => setReordenando(true)}><Icone nome="reordenar" tamanho={14} />Reordenar</button>
          )}
        </div>
        <div className="at-grade">
          {principais.map((f, i) => <Cartao key={f.id} f={f} selo={f.selo?.(b, eu?.id)} reordenando={reordenando} mover={(d) => mover(f.id, d)} primeiro={i === 0} ultimo={i === principais.length - 1} />)}
        </div>
      </section>

      <section className="at-secao">
        <div className="at-secao-cab"><h2>Outras ferramentas</h2></div>
        <div className="at-grade">
          {OUTRAS.filter((f) => !f.admin || eu?.papel === 'advogado').map((f) => <Cartao key={f.id} f={f} selo={f.selo?.(b, eu?.id)} />)}
        </div>
      </section>
    </div>
  );
}
