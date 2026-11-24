// Página inicial pública do Spartacus (antes do login).
// Minimalista: uma mensagem, uma ação (Entrar) e uma prévia viva do produto — o prazo é calculado de verdade.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { nomeExibido, PRODUTO, useMarca } from '../marca';
import { Icone } from '../components/icones';
import { formatarComSemana, hoje } from '../lib/datas';
import { prazoJudicial } from '../lib/prazos';
import '../inicio.css';

const FLUXO: { n: string; titulo: string; texto: string }[] = [
  { n: '01', titulo: 'A intimação chega', texto: 'Um clique busca no DJEN tudo o que saiu para as OABs do escritório, sem abrir diário por diário.' },
  { n: '02', titulo: 'O prazo se calcula', texto: 'Dias úteis pelo CPC, feriados nacionais, estaduais e municipais, recesso de 20/12 a 20/01. Exigência do INSS em dias corridos.' },
  { n: '03', titulo: 'Vira tarefa', texto: 'Com responsável, data fatal e etiqueta. Aparece no quadro de quem vai fazer, em Hoje ou Próximos dias.' },
  { n: '04', titulo: 'Tudo fica visível', texto: 'Painel com produção, audiências e procedência. Resposta pronta para o cliente que pergunta no WhatsApp.' },
];

const MODULOS: { icone: string; titulo: string; texto: string }[] = [
  { icone: 'controladoria', titulo: 'Controladoria', texto: 'Caixa de intimações do DJEN, cada uma com prazo e responsável.' },
  { icone: 'agenda', titulo: 'Prazos e agenda', texto: 'Calculadora em dias úteis e corridos, com o motivo de cada dia pulado.' },
  { icone: 'processos', titulo: 'Processos', texto: 'JEF, cível, trabalhista e INSS numa base só; fases lidas das movimentações.' },
  { icone: 'tarefas', titulo: 'Tarefas', texto: 'Quadro por dia, pontos por complexidade, comentários e histórico.' },
  { icone: 'whatsapp', titulo: 'Central do WhatsApp', texto: 'Classifica o pedido, acha o processo e monta a resposta.' },
  { icone: 'clientes', titulo: 'Previdenciário rural', texto: 'Triagem do grupo familiar: aposentadoria rural, salário-maternidade e BPC.' },
];

/** Prévia viva: um prazo de 15 dias úteis disponibilizado hoje, calculado pelas regras reais do sistema. */
function Previa() {
  const h = hoje();
  const r = prazoJudicial(h, 15, { ufs: [] });
  const naoContados = r.pulados.length;
  const feriados = r.pulados.filter((p) => !['sábado', 'domingo'].includes(p.motivo));
  return (
    <div className="pub-previa" aria-label="Prévia do Spartacus">
      <div className="pub-janela-barra"><i /><i /><i /><span>Spartacus · Controladoria</span></div>
      <div className="pub-janela">
        <div className="pub-intimacao">
          <div className="pub-int-cab">
            <span className="pub-tag">DJEN</span>
            <span className="pub-mono">TRF1 · Intimação</span>
            <span className="pub-hoje">disponibilizada hoje</span>
          </div>
          <p>Intime-se a parte autora para se manifestar sobre a contestação no prazo de 15 dias.</p>
          <dl className="pub-calc">
            <div><dt>Publicação</dt><dd>{formatarComSemana(r.publicacao!)}</dd></div>
            <div><dt>Início</dt><dd>{formatarComSemana(r.inicio)}</dd></div>
            <div className="fatal"><dt>Data fatal</dt><dd>{formatarComSemana(r.fatal)}</dd></div>
          </dl>
          <div className="pub-pulados">
            {naoContados} dias não contados{feriados.length ? ` · inclui ${feriados.map((f) => f.motivo.replace(' (conferir)', '')).slice(0, 2).join(', ')}` : ' · fins de semana'}
          </div>
        </div>
        <div className="pub-mini-quadro">
          {[
            { t: 'Hoje', cor: 'var(--pub-cinza)', itens: [['Réplica à contestação', 'Hoje 17:00', ['#f97316', '#ef4444']], ['Cumprir exigência do INSS', 'Ontem', ['#5b9cff']]] },
            { t: 'Próximos dias', cor: '#5b9cff', itens: [['Rol de testemunhas', 'Amanhã', ['#8b5cf6']]] },
            { t: 'Fazendo', cor: '#fcd535', itens: [['Petição inicial — BPC', 'Em 3 dias', []]] },
          ].map((c) => (
            <div key={c.t} className="pub-mini-col">
              <div className="pub-mini-cab"><span style={{ borderColor: c.cor }} />{c.t}</div>
              {c.itens.map(([titulo, quando, barras]) => (
                <div key={titulo as string} className="pub-mini-card">
                  {(barras as string[]).length > 0 && <div className="pub-barras">{(barras as string[]).map((b) => <i key={b} style={{ background: b }} />)}</div>}
                  <b>{titulo as string}</b>
                  <small className={quando === 'Ontem' ? 'atraso' : ''}>{quando as string}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Inicio({ destinoEntrar, logado = false }: { destinoEntrar: string; logado?: boolean }) {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 8);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const { marca, escritorio } = useMarca();
  const nome = escritorio ? nomeExibido(marca) : PRODUTO;
  const rotulo = logado ? `Abrir o ${escritorio ? 'sistema' : PRODUTO}` : 'Entrar';
  const ano = hoje().slice(0, 4);

  return (
    <div className="pub">
      <header className={`pub-topo${rolou ? ' rolou' : ''}`}>
        <Link to="/" className="pub-marca" aria-label={`${nome} — início`}>
          <img src={marca.logo || '/logo.svg'} alt="" width={30} height={30} style={{ objectFit: 'contain' }} />
          <span>{nome}</span>
        </Link>
        <nav className="pub-nav" aria-label="Seções">
          <a href="#fluxo">Como funciona</a>
          <a href="#modulos">Módulos</a>
        </nav>
        <Link to={destinoEntrar} className="pub-btn pub-btn-contorno">{rotulo}</Link>
      </header>

      <main>
        <section className="pub-hero">
          <div className="pub-hero-texto">
            <p className="pub-sobretitulo">{escritorio ? `Sistema de ${marca.nome}` : `${PRODUTO} · software jurídico para escritórios`}</p>
            <h1>Cada prazo, cada processo, cada cliente <span>no lugar certo.</span></h1>
            <p className="pub-lead">
              Publicações, prazos, atividades e atendimento num só lugar, com foco em quem atua em volume no INSS, na Justiça Federal e na Estadual.
            </p>
            <div className="pub-acoes">
              <Link to={destinoEntrar} className="pub-btn pub-btn-primario">{rotulo} <span aria-hidden="true">→</span></Link>
              <a href="#fluxo" className="pub-btn pub-btn-fantasma">Como funciona</a>
            </div>
            <ul className="pub-garantias">
              <li><Icone nome="cpf" tamanho={16} />Acesso só para a equipe liberada</li>
              <li><Icone nome="integracoes" tamanho={16} />DJEN e DataJud (CNJ)</li>
              <li><Icone nome="agenda" tamanho={16} />Prazos com feriados nacionais, estaduais e municipais</li>
            </ul>
          </div>
          <Previa />
        </section>

        <section id="fluxo" className="pub-secao pub-escura">
          <div className="pub-dentro">
          <div className="pub-secao-cab">
            <p className="pub-sobretitulo">Como funciona</p>
            <h2>Da publicação ao cliente informado, sem planilha no meio.</h2>
          </div>
          <ol className="pub-fluxo">
            {FLUXO.map((f) => (
              <li key={f.n}>
                <span className="pub-num">{f.n}</span>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
              </li>
            ))}
          </ol>
          </div>
        </section>

        <section id="modulos" className="pub-secao pub-pergaminho">
          <div className="pub-dentro">
          <div className="pub-secao-cab">
            <p className="pub-sobretitulo">Módulos</p>
            <h2>O essencial de um escritório, num lugar só.</h2>
          </div>
          <div className="pub-modulos">
            {MODULOS.map((m) => (
              <article key={m.titulo}>
                <span className="pub-icone"><Icone nome={m.icone} tamanho={20} /></span>
                <h3>{m.titulo}</h3>
                <p>{m.texto}</p>
              </article>
            ))}
          </div>
          </div>
        </section>

        <section className="pub-final">
          <h2>Pronto para começar o dia?</h2>
          <Link to={destinoEntrar} className="pub-btn pub-btn-primario">{rotulo} <span aria-hidden="true">→</span></Link>
          <p>Ainda sem acesso? Peça ao administrador do escritório.</p>
        </section>
      </main>

      <footer className="pub-rodape">
        <p>© {ano} {escritorio ? [marca.nome, marca.rodape].filter(Boolean).join(' · ') : PRODUTO}{escritorio ? ` · feito com ${PRODUTO}` : ''}</p>
      </footer>
    </div>
  );
}
