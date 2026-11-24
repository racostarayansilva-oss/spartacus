// Área de trabalho: o que a pessoa precisa fazer hoje (prazos, atividades, audiências), as publicações
// que chegaram, os clientes recentes e todas as ferramentas do escritório em cartões.
// A ordem das ferramentas e a visão "Minha/Equipe" são de cada pessoa e ficam salvas neste navegador.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banco, useBanco, usuarioAtual } from '../store';
import { diasEntre, formatar, formatarComSemana, hoje } from '../lib/datas';
import { Icone } from '../components/icones';
import { primeiroNome } from '../lib/notificacoes';
import { ItemDia, montarMeuDia } from '../lib/meuDia';
import { progresso } from '../lib/implantacao';
import { rotaLiberada } from '../menu';
import { useMarca } from '../marca';

type Selo = 'novo' | number | undefined;
type Ferramenta = { id: string; rota: string; titulo: string; descricao: string; icone: string; selo?: (b: Banco, eu?: string) => Selo; admin?: boolean };

const PRINCIPAIS: Ferramenta[] = [
  { id: 'clientes', rota: '/clientes', titulo: 'Clientes e contatos', descricao: 'Cadastro e dossiê de cada cliente', icone: 'clientes' },
  { id: 'processos', rota: '/processos', titulo: 'Processos', descricao: 'Processos judiciais e administrativos do escritório', icone: 'processos' },
  { id: 'intimacoes', rota: '/controladoria', titulo: 'Publicações', descricao: 'Cada publicação vira um prazo com responsável', icone: 'controladoria', selo: (b) => b.intimacoes.filter((i) => i.status === 'nova').length },
  { id: 'agenda', rota: '/agenda', titulo: 'Prazos e agenda', descricao: 'Prazos, audiências e compromissos da equipe', icone: 'agenda', selo: (b) => b.compromissos.filter((c) => c.status === 'pendente' && c.data <= hoje()).length },
  { id: 'tarefas', rota: '/tarefas', titulo: 'Atividades', descricao: 'Quadro de atividades e distribuição da equipe', icone: 'tarefas', selo: (b, eu) => b.tarefas.filter((t) => t.responsavelId === eu && t.coluna !== 'concluido').length },
  { id: 'documentos', rota: '/documentos', titulo: 'Documentos', descricao: 'Procurações, contratos e petições a partir dos modelos', icone: 'documentos' },
  { id: 'emails', rota: '/emails', titulo: 'E-mails dos clientes', descricao: 'Códigos do gov.br e avisos do Meu INSS no e-mail gerado', icone: 'email', selo: (b) => b.emails.filter((e) => !e.lido).length },
  { id: 'whatsapp', rota: '/whatsapp', titulo: 'WhatsApp', descricao: 'Classifica pedidos e monta a resposta pronta', icone: 'whatsapp' },
  { id: 'financeiro', rota: '/financeiro', titulo: 'Financeiro', descricao: 'Honorários, receitas, despesas e valores a receber', icone: 'financeiro' },
  { id: 'producao', rota: '/producao', titulo: 'Produção e relatórios', descricao: 'Relatório diário, painel mensal e ranking', icone: 'producao' },
  { id: 'painel', rota: '/painel', titulo: 'Painel de indicadores', descricao: 'Entradas, protocolos, audiências e resultados', icone: 'painel' },
];

const OUTRAS: Ferramenta[] = [
  { id: 'cnis', rota: '/ferramentas/cnis', titulo: 'Indicadores do CNIS', descricao: 'O que significa e o que fazer com cada indicador do CNIS', icone: 'cnis' },
  { id: 'comprimir', rota: '/ferramentas/comprimir', titulo: 'Comprimir PDFs', descricao: 'Reduza o tamanho para enviar ao INSS e ao PJe', icone: 'comprimir' },
  { id: 'dividir', rota: '/ferramentas/dividir', titulo: 'Dividir PDFs', descricao: 'Divida PDFs por páginas ou por tamanho', icone: 'tesoura' },
  { id: 'imagens', rota: '/ferramentas/imagens', titulo: 'Converter imagens em PDF', descricao: 'Fotos de documentos (JPG, PNG, WebP) em um PDF', icone: 'imagem' },
  { id: 'juntar', rota: '/ferramentas/juntar', titulo: 'Juntar PDFs', descricao: 'Junte vários PDFs e imagens em um único arquivo', icone: 'camadas' },
  { id: 'senhas', rota: '/senhas', titulo: 'Diretório de senhas', descricao: 'Acessos do escritório e dos clientes (só administradores)', icone: 'chave', admin: true },
  { id: 'normas', rota: '/normas', titulo: 'Normas', descricao: 'Legislação federal pesquisável e fichas do escritório', icone: 'normas' },
  { id: 'cpf', rota: '/cpf', titulo: 'Decisões por CPF', descricao: 'Processos e decisões em que a pessoa é parte', icone: 'cpf' },
  { id: 'ditado', rota: '/ditado', titulo: 'Ditado', descricao: 'Fale e ele transcreve; depois pode resumir', icone: 'speak' },
  { id: 'crm', rota: '/crm', titulo: 'CRM', descricao: 'Atendimento e contatos', icone: 'crm' },
];

const chave = (uid: string) => `spartacus:ordem-ferramentas:${uid}`;
const CHAVE_VISAO = 'spartacus:visao-dia';

function ler<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem(k);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch { return padrao; }
}
function gravar(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fica só nesta sessão */ }
}

function ordenar(ids: string[], lista: Ferramenta[]) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...lista].sort((a, b) => (pos.get(a.id) ?? 99 + lista.indexOf(a)) - (pos.get(b.id) ?? 99 + lista.indexOf(b)));
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

const ICONE_TIPO: Record<ItemDia['tipo'], string> = { prazo: 'relogio', atividade: 'tarefas', audiencia: 'martelo' };
const ROTULO_TIPO: Record<ItemDia['tipo'], string> = { prazo: 'Prazo', atividade: 'Atividade', audiencia: 'Audiência' };

function quando(d: string, h: string): string {
  const n = diasEntre(h, d);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  if (n < 0) return `${-n} dias atrás`;
  return formatarComSemana(d).replace(/\/\d{4}/, ''); // 25/11 (quarta)
}

function GrupoDia({ titulo, itens, h, nomes, tom, mostrarQuem }: { titulo: string; itens: ItemDia[]; h: string; nomes: Map<string, string>; tom?: 'vermelho'; mostrarQuem: boolean }) {
  if (!itens.length) return null;
  return (
    <div className="dia-grupo">
      <h3 className={tom ? 'texto-vermelho' : ''}>{titulo} <span className="num mudo">{itens.length}</span></h3>
      <ul>
        {itens.slice(0, 12).map((i) => (
          <li key={`${i.tipo}-${i.id}`}>
            <Link to={i.rota} className={`dia-item ${i.tipo}`}>
              <span className="dia-icone" title={ROTULO_TIPO[i.tipo]}><Icone nome={ICONE_TIPO[i.tipo]} tamanho={16} /></span>
              <span className="dia-texto">
                <b>{i.titulo}</b>
                <small>{[ROTULO_TIPO[i.tipo], i.detalhe, mostrarQuem && i.responsavelId ? primeiroNome(nomes.get(i.responsavelId) || '') : ''].filter(Boolean).join(' · ')}</small>
              </span>
              <span className={`dia-quando ${i.data < h ? 'texto-vermelho' : ''}`}>{quando(i.data, h)}{i.hora ? ` ${i.hora}` : ''}</span>
            </Link>
          </li>
        ))}
        {itens.length > 12 && <li className="mudo" style={{ padding: '6px 10px' }}>…e mais {itens.length - 12}. <Link to="/agenda">Ver na agenda</Link></li>}
      </ul>
    </div>
  );
}

export default function AreaTrabalho() {
  const b = useBanco();
  const { escritorio, marca } = useMarca();
  const eu = usuarioAtual(b);
  const uid = eu?.id ?? 'anonimo';
  const h = hoje();
  const desligados = escritorio?.modulos_desligados || [];
  const liberada = (f: Ferramenta) => rotaLiberada(f.rota, desligados) && (!f.admin || eu?.papel === 'advogado');

  const [ordem, setOrdem] = useState<string[]>(() => ler<string[]>(chave(uid), []));
  const [reordenando, setReordenando] = useState(false);
  const [visao, setVisao] = useState<'minha' | 'equipe'>(() => ler(CHAVE_VISAO, 'minha'));
  const principais = ordenar(ordem, PRINCIPAIS.filter(liberada));

  const salvar = (ids: string[]) => { setOrdem(ids); gravar(chave(uid), ids); };
  const mover = (id: string, d: -1 | 1) => {
    const ids = principais.map((f) => f.id);
    const i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    salvar(ids);
  };
  const mudarVisao = (v: 'minha' | 'equipe') => { setVisao(v); gravar(CHAVE_VISAO, v); };

  const dia = useMemo(() => montarMeuDia(b, h, visao === 'minha' ? uid : null), [b.compromissos, b.tarefas, b.audiencias, b.processos, b.clientes, h, visao, uid]);
  const nomes = useMemo(() => new Map(b.usuarios.map((u) => [u.id, u.nome])), [b.usuarios]);
  const publicacoes = b.intimacoes.filter((i) => i.status === 'nova').sort((x, y) => y.disponibilizacao.localeCompare(x.disponibilizacao));
  const recentes = [...b.clientes].sort((x, y) => (y.criadoEm || '').localeCompare(x.criadoEm || '')).slice(0, 5);
  const audiencias7 = b.audiencias.filter((a) => a.data >= h && diasEntre(h, a.data) <= 7).length;
  const prazosVencidos = b.compromissos.filter((c) => c.status === 'pendente' && c.data <= h).length;
  const minhas = b.tarefas.filter((t) => t.coluna !== 'concluido' && (t.responsavelId === uid || t.participantes?.includes(uid))).length;
  const emails = b.emails.filter((e) => !e.lido).length;
  const totalDia = dia.atrasados.length + dia.hoje.length + dia.proximos.length;
  const impl = escritorio?.situacao === 'implantacao' && eu?.papel === 'advogado' ? progresso(escritorio.implantacao as any) : null;

  const indicadores: [string, string, number, string, boolean][] = [
    ['/controladoria', 'Publicações novas', publicacoes.length, 'controladoria', publicacoes.length > 0],
    ['/agenda', 'Prazos para hoje ou vencidos', prazosVencidos, 'relogio', prazosVencidos > 0],
    ['/tarefas', 'Minhas atividades abertas', minhas, 'tarefas', false],
    ['/agenda', 'Audiências em 7 dias', audiencias7, 'martelo', false],
    ['/emails', 'E-mails não lidos', emails, 'email', false],
  ];

  return (
    <div className="area-trabalho">
      <section className="at-hero" aria-labelledby="titulo-saudacao">
        <div className="at-hero-texto">
          <p className="at-hero-data">{formatarComSemana(h)}</p>
          <h1 id="titulo-saudacao">{saudacao()}{eu ? `, ${primeiroNome(eu.nome)}` : ''}.</h1>
          <p className="at-hero-lead">
            <span>{dia.atrasados.length + dia.hoje.length
              ? <><em className="num">{dia.atrasados.length + dia.hoje.length}</em> {dia.atrasados.length + dia.hoje.length === 1 ? 'item pede' : 'itens pedem'} atenção hoje{dia.atrasados.length ? `, ${dia.atrasados.length} em atraso` : ''}.</>
              : 'Nada pendente para hoje.'}</span>
            <span className="at-hero-escritorio">{(escritorio ? marca.nome : b.config.nomeEscritorio) || marca.nome}</span>
          </p>
        </div>
        <div className="at-indicadores">
          {indicadores.filter(([rota]) => rotaLiberada(rota, desligados)).map(([rota, rotulo, n, icone, alerta]) => (
            <Link key={rotulo} to={rota} className={`at-indicador ${alerta ? 'alerta' : ''}`}>
              <span className="valor num">{n}</span>
              <span className="rotulo"><Icone nome={icone} tamanho={14} />{rotulo}</span>
            </Link>
          ))}
        </div>
      </section>

      {impl && !impl.concluida && (
        <Link to={impl.proximo?.rota || '/config'} className="at-implantacao">
          <span><b>Implantação do escritório: {impl.percentual}%</b><small>Próximo passo: {impl.proximo?.titulo}</small></span>
          <span className="barra" aria-hidden="true"><span style={{ width: `${impl.percentual}%` }} /></span>
        </Link>
      )}

      <div className="at-colunas">
        <section className="cartao at-dia" aria-labelledby="titulo-dia">
          <div className="at-secao-cab">
            <h2 id="titulo-dia">{visao === 'minha' ? 'Meu dia' : 'Dia da equipe'}</h2>
            <div className="segmentado" role="group" aria-label="De quem">
              <button className={visao === 'minha' ? 'ativo' : ''} onClick={() => mudarVisao('minha')}>Meus</button>
              <button className={visao === 'equipe' ? 'ativo' : ''} onClick={() => mudarVisao('equipe')}>Equipe</button>
            </div>
          </div>
          {!totalDia ? (
            <div className="dia-vazio">
              <Icone nome="feito" tamanho={28} />
              <p>Nada pendente para os próximos 7 dias.</p>
              <Link to="/tarefas?nova=1" className="btn pequeno">Criar atividade</Link>
            </div>
          ) : (
            <>
              <GrupoDia titulo="Atrasados" itens={dia.atrasados} h={h} nomes={nomes} tom="vermelho" mostrarQuem={visao === 'equipe'} />
              <GrupoDia titulo="Hoje" itens={dia.hoje} h={h} nomes={nomes} mostrarQuem={visao === 'equipe'} />
              <GrupoDia titulo="Próximos 7 dias" itens={dia.proximos} h={h} nomes={nomes} mostrarQuem={visao === 'equipe'} />
            </>
          )}
        </section>

        <div className="at-lado">
          {rotaLiberada('/controladoria', desligados) && (
            <section className="cartao" aria-labelledby="titulo-pub">
              <div className="at-secao-cab"><h2 id="titulo-pub">Publicações</h2><Link to="/controladoria" className="btn pequeno fantasma">Ver todas ›</Link></div>
              {!publicacoes.length ? <p className="mudo" style={{ margin: 0 }}>Nenhuma publicação nova. A busca no DJEN roda sozinha às 7h e às 13h.</p> : (
                <ul className="at-mini">
                  {publicacoes.slice(0, 5).map((i) => (
                    <li key={i.id}>
                      <Link to="/controladoria">
                        <b className="mono">{i.processoNumero}</b>
                        <small>{i.tribunal} · {formatar(i.disponibilizacao)} · {i.texto.slice(0, 90)}…</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="cartao" aria-labelledby="titulo-cli">
            <div className="at-secao-cab"><h2 id="titulo-cli">Clientes recentes</h2><Link to="/clientes?novo=1" className="btn pequeno fantasma"><Icone nome="mais" tamanho={14} />Novo</Link></div>
            {!recentes.length ? <p className="mudo" style={{ margin: 0 }}>Nenhum cliente cadastrado ainda.</p> : (
              <ul className="at-mini">
                {recentes.map((c) => (
                  <li key={c.id}>
                    <Link to={`/clientes?cliente=${c.id}`}>
                      <b>{c.nome}</b>
                      <small>{[c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`, c.criadoEm && `desde ${formatar(c.criadoEm)}`].filter(Boolean).join(' · ')}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="at-secao">
        <div className="at-secao-cab">
          <h2>Ferramentas</h2>
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
          {OUTRAS.filter(liberada).map((f) => <Cartao key={f.id} f={f} selo={f.selo?.(b, eu?.id)} />)}
        </div>
      </section>
    </div>
  );
}
