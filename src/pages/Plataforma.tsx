// Console da plataforma (equipe Spartacus): cria escritórios, acompanha a implantação de cada um
// (meta: até 3 horas) e controla plano, situação, domínios e módulos.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DOMINIO_PLATAFORMA } from '../config';
import { FormMarca, PreviaMarca } from '../components/MarcaEscritorio';
import { Icone } from '../components/icones';
import {
  alternarPasso, duracao, enderecoEscritorio, limparDominioProprio, MINUTOS_PREVISTOS, minutosDecorridos, PASSOS_IMPLANTACAO,
  passoFeito, progresso, slugDoNome, slugValido,
} from '../lib/implantacao';
import { Marca, MARCA_PADRAO, PRODUTO } from '../marca';
import { MENU } from '../menu';
import { atualizarEscritorio, criarEscritorio, EscritorioPlataforma, listarEscritorios, sair, useNuvem, UsoEscritorio } from '../nuvem';

const ROTULO_SITUACAO: Record<EscritorioPlataforma['situacao'], string> = {
  implantacao: 'Em implantação', ativo: 'Ativo', suspenso: 'Suspenso', cancelado: 'Cancelado',
};
const COR_SITUACAO: Record<EscritorioPlataforma['situacao'], string> = { implantacao: 'ambar', ativo: 'verde', suspenso: 'vermelho', cancelado: '' };
const PLANOS = { essencial: 'Essencial', profissional: 'Profissional', diamante: 'Diamante' } as const;

const endereco = (e: Pick<EscritorioPlataforma, 'slug' | 'dominios'>) => enderecoEscritorio(e.slug, DOMINIO_PLATAFORMA, e.dominios, window.location.origin);

function lerOabs(texto: string): { numero: string; uf: string }[] {
  return texto.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.toUpperCase().match(/([A-Z]{2})?\s*[/ -]?\s*([\d.]+[A-Z]?)\s*[/ -]?\s*([A-Z]{2})?/);
    return { numero: (m?.[2] || '').replace(/\./g, ''), uf: m?.[3] || m?.[1] || '' };
  }).filter((o) => o.numero && o.uf);
}

// ---------- novo escritório ----------

function NovoEscritorio({ aoCriar }: { aoCriar: (id: string) => void }) {
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugMexido, setSlugMexido] = useState(false);
  const [plano, setPlano] = useState<keyof typeof PLANOS>('profissional');
  const [oabs, setOabs] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [marca, setMarca] = useState<Marca>({});
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const s = slugMexido ? slug : slugDoNome(nome);
  const oabsLidas = lerOabs(oabs);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return setErro('Informe o nome do escritório.');
    if (!slugValido(s)) return setErro('Endereço inválido: use de 3 a 40 letras minúsculas, números e hífen.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail.trim())) return setErro('E-mail do administrador inválido.');
    if (oabs.trim() && !oabsLidas.length) return setErro('Não entendi as OABs. Exemplo: 123456/SP, 7890/MA');
    setSalvando(true);
    try {
      const id = await criarEscritorio({ slug: s, nome: nome.trim(), marca: { ...marca, nome: marca.nome || nome.trim() }, plano, adminEmail, adminNome, oabs: oabsLidas });
      aoCriar(id);
    } catch (er: any) {
      setErro(er.message);
      setSalvando(false);
    }
  };

  return (
    <form className="cartao" onSubmit={enviar}>
      <h2 style={{ marginBottom: 4 }}>Novo escritório</h2>
      <p className="mudo" style={{ marginTop: 0 }}>Passo 1 do roteiro (cerca de 10 min). Depois de criar, siga o roteiro de implantação ao lado do escritório.</p>
      <div className="grade-2">
        <label className="campo">Nome do escritório<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Silva & Souza Advocacia" required autoFocus /></label>
        <label className="campo">Endereço (subdomínio)
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={s} onChange={(e) => { setSlugMexido(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} style={{ fontFamily: 'var(--fonte-mono)' }} />
            {DOMINIO_PLATAFORMA && <span className="mudo" style={{ whiteSpace: 'nowrap' }}>.{DOMINIO_PLATAFORMA}</span>}
          </span>
        </label>
        <label className="campo">Plano
          <select value={plano} onChange={(e) => setPlano(e.target.value as keyof typeof PLANOS)}>
            {Object.entries(PLANOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="campo">OABs (para buscar as intimações no DJEN)<input value={oabs} onChange={(e) => setOabs(e.target.value)} placeholder="123456/SP, 7890/MA" />
          {oabsLidas.length > 0 && <span className="mudo" style={{ fontSize: 12 }}>{oabsLidas.map((o) => `OAB/${o.uf} ${o.numero}`).join(' · ')}</span>}
        </label>
        <label className="campo">E-mail do administrador<input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="socio@silvasouza.adv.br" required /></label>
        <label className="campo">Nome do administrador<input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Dra. Ana Silva" /></label>
      </div>
      <h3 style={{ margin: '18px 0 8px' }}>Marca (pode ajustar depois)</h3>
      <FormMarca marca={{ ...marca, nome: marca.nome ?? nome }} aoMudar={setMarca} />
      {erro && <div className="erro" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
      <button className="btn primario" style={{ marginTop: 14 }} disabled={salvando}>{salvando ? 'Criando…' : 'Criar escritório'}</button>
    </form>
  );
}

// ---------- ficha do escritório ----------

function FichaEscritorio({ e, uso, aoMudar }: { e: EscritorioPlataforma; uso?: UsoEscritorio; aoMudar: () => void }) {
  const n = useNuvem();
  const [erro, setErro] = useState('');
  const [dominio, setDominio] = useState('');
  const [marca, setMarca] = useState<Marca>(e.marca || {});
  const [whats, setWhats] = useState(e.whatsapp || {});
  const [agora, setAgora] = useState(() => new Date().toISOString());
  useEffect(() => { const t = setInterval(() => setAgora(new Date().toISOString()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { setMarca(e.marca || {}); setWhats(e.whatsapp || {}); }, [e.id]);

  const p = progresso(e.implantacao);
  const decorrido = minutosDecorridos(e.implantacao, agora);
  const estourou = decorrido !== null && !p.concluida && decorrido > MINUTOS_PREVISTOS;
  const url = endereco(e);

  const salvar = async (m: Parameters<typeof atualizarEscritorio>[1]) => {
    setErro('');
    try { await atualizarEscritorio(e.id, m); aoMudar(); } catch (er: any) { setErro(er.message); }
  };
  const marcar = (id: string) => salvar({ implantacao: alternarPasso(e.implantacao, id, n.perfil?.auth_id || '', new Date().toISOString()) });
  const addDominio = () => {
    const d = limparDominioProprio(dominio);
    if (!d) return setErro('Domínio inválido. Exemplo: sistema.silvaadvocacia.com.br');
    setDominio('');
    salvar({ dominios: [...new Set([...e.dominios, d])] });
  };

  return (
    <div className="plat-ficha">
      <div className="cartao">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={e.marca?.logo || '/logo.png'} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: 'contain', background: 'var(--superficie-2)' }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0 }}>{e.nome}</h2>
            <a href={url} target="_blank" rel="noreferrer" className="mono">{url.replace(/^https?:\/\//, '')}</a>
          </div>
          <span className={`etiqueta ${COR_SITUACAO[e.situacao]}`}>{ROTULO_SITUACAO[e.situacao]}</span>
        </div>
        {uso && (
          <div className="plat-numeros">
            <span><b className="num">{uso.usuarios}</b> pessoas</span>
            <span><b className="num">{uso.processos}</b> processos</span>
            <span><b className="num">{uso.clientes}</b> clientes</span>
            <span><b className="num">{uso.tarefas}</b> tarefas</span>
            <span>Último uso: {uso.ultimo_uso ? new Date(uso.ultimo_uso).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        )}
      </div>

      <div className="cartao">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flex: 1 }}>Implantação</h3>
          <span className={estourou ? 'texto-vermelho' : 'mudo'}>
            {decorrido === null ? `Previsto: ${duracao(MINUTOS_PREVISTOS)}` : `${p.concluida ? 'Concluída em' : 'Decorrido:'} ${duracao(decorrido)} de ${duracao(MINUTOS_PREVISTOS)}`}
          </span>
        </div>
        <div className="barra" style={{ margin: '10px 0' }} aria-label={`${p.percentual}% concluído`}><span style={{ width: `${p.percentual}%` }} /></div>
        <ol className="plat-passos">
          {PASSOS_IMPLANTACAO.map((passo) => {
            const feito = passoFeito(e.implantacao, passo.id);
            return (
              <li key={passo.id} className={feito ? 'feito' : p.proximo?.id === passo.id ? 'proximo' : ''}>
                <label>
                  <input type="checkbox" checked={feito} onChange={() => marcar(passo.id)} />
                  <span>
                    <b>{passo.titulo}</b> <span className="mudo">· {passo.minutos} min</span>
                    <small>{passo.como}{passo.rota && <> — <a href={url.includes('/?') ? url.replace('/?', `${passo.rota}?`) : `${url}${passo.rota}`} target="_blank" rel="noreferrer">abrir no app</a></>}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
        {p.concluida && e.situacao === 'implantacao' && (
          <button className="btn primario" onClick={() => salvar({ situacao: 'ativo' })}>Marcar escritório como ativo</button>
        )}
      </div>

      <div className="cartao">
        <h3>Contrato e acesso</h3>
        <div className="grade-2">
          <label className="campo">Situação
            <select value={e.situacao} onChange={(x) => salvar({ situacao: x.target.value as EscritorioPlataforma['situacao'] })}>
              {Object.entries(ROTULO_SITUACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label className="campo">Plano
            <select value={e.plano} onChange={(x) => salvar({ plano: x.target.value as EscritorioPlataforma['plano'] })}>
              {Object.entries(PLANOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
        </div>
        <h4 style={{ margin: '14px 0 6px' }}>Domínio próprio</h4>
        <p className="mudo" style={{ marginTop: 0, fontSize: 13 }}>
          No DNS do escritório, crie um registro <span className="mono">CNAME</span> apontando para <span className="mono">{DOMINIO_PLATAFORMA || 'o domínio da plataforma'}</span>. O certificado HTTPS é emitido sozinho no primeiro acesso.
        </p>
        <ul className="lista">
          {e.dominios.map((d) => (
            <li key={d}><span className="mono" style={{ flex: 1 }}>{d}</span><button className="btn pequeno fantasma" onClick={() => salvar({ dominios: e.dominios.filter((x) => x !== d) })}>Remover</button></li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={dominio} onChange={(x) => setDominio(x.target.value)} placeholder="sistema.silvaadvocacia.com.br" aria-label="Novo domínio" />
          <button className="btn" onClick={addDominio}>Adicionar</button>
        </div>

        <h4 style={{ margin: '16px 0 6px' }}>Módulos ligados</h4>
        <div className="plat-modulos">
          {MENU.filter(([to]) => to !== '/' && to !== '/config').map(([to, rotulo]) => {
            const ligado = !e.modulos_desligados.includes(to);
            return (
              <label key={to} className="caixa">
                <input type="checkbox" checked={ligado} onChange={() => salvar({ modulos_desligados: ligado ? [...e.modulos_desligados, to] : e.modulos_desligados.filter((x) => x !== to) })} />
                {rotulo}
              </label>
            );
          })}
        </div>

        <h4 style={{ margin: '16px 0 6px' }}>WhatsApp do escritório (Evolution API)</h4>
        <div className="grade-2">
          <label className="campo">Instância<input value={whats.instancia || ''} onChange={(x) => setWhats({ ...whats, instancia: x.target.value.trim() })} placeholder={e.slug} /></label>
          <label className="campo">Destino dos resumos<input value={whats.destino || ''} onChange={(x) => setWhats({ ...whats, destino: x.target.value.trim() })} placeholder="5511999999999 ou id do grupo" /></label>
        </div>
        <button className="btn pequeno" style={{ marginTop: 8 }} onClick={() => salvar({ whatsapp: whats })}>Salvar WhatsApp</button>
      </div>

      <div className="cartao">
        <h3>Marca</h3>
        <FormMarca marca={marca} aoMudar={setMarca} />
        <button className="btn primario" style={{ marginTop: 12 }} onClick={() => salvar({ marca, nome: marca.nome?.trim() || e.nome })}>Salvar marca</button>
      </div>
      {erro && <div className="erro" role="alert">{erro}</div>}
    </div>
  );
}

// ---------- página ----------

export default function Plataforma({ sozinha = false }: { sozinha?: boolean }) {
  const [lista, setLista] = useState<EscritorioPlataforma[]>([]);
  const [uso, setUso] = useState<Map<string, UsoEscritorio>>(new Map());
  const [sel, setSel] = useState<string | 'novo' | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = () => listarEscritorios()
    .then((r) => { setLista(r.escritorios); setUso(r.uso); setErro(''); })
    .catch((e) => setErro(e.message))
    .finally(() => setCarregando(false));
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((e) => `${e.nome} ${e.slug} ${e.dominios.join(' ')}`.toLowerCase().includes(q)) : lista;
  }, [lista, busca]);
  const atual = lista.find((e) => e.id === sel);
  const conta = (s: EscritorioPlataforma['situacao']) => lista.filter((e) => e.situacao === s).length;
  const tempos = lista.filter((e) => progresso(e.implantacao).concluida).map((e) => minutosDecorridos(e.implantacao, new Date().toISOString())!);
  const media = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;

  const corpo = (
    <div className="plataforma">
      <div className="cabecalho">
        <div>
          <h1>Plataforma {PRODUTO}</h1>
          <p className="subtitulo">Escritórios contratantes, implantação e acesso.</p>
        </div>
        <button className="btn primario" onClick={() => setSel('novo')}><Icone nome="mais" tamanho={16} />Novo escritório</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><span className="rotulo">Ativos</span><span className="valor num">{conta('ativo')}</span></div>
        <div className="stat"><span className="rotulo">Em implantação</span><span className="valor num">{conta('implantacao')}</span></div>
        <div className="stat"><span className="rotulo">Suspensos</span><span className="valor num">{conta('suspenso')}</span></div>
        <div className="stat destaque"><span className="rotulo">Tempo médio de implantação</span><span className="valor num">{media === null ? '—' : duracao(media)}</span></div>
      </div>

      {erro && <div className="erro" role="alert">{erro}{/plataforma_|escritorios/.test(erro) && ' — rode o supabase/schema.sql do Spartacus.'}</div>}

      <div className="plat-grade">
        <div className="cartao plat-lista">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar escritório ou domínio" aria-label="Buscar escritório" />
          {carregando ? <p className="mudo">Carregando…</p> : !filtrados.length ? <p className="mudo">Nenhum escritório ainda.</p> : (
            <ul>
              {filtrados.map((e) => {
                const p = progresso(e.implantacao);
                return (
                  <li key={e.id}>
                    <button className={sel === e.id ? 'ativo' : ''} onClick={() => setSel(e.id)}>
                      <img src={e.marca?.logo || '/logo.png'} alt="" width={28} height={28} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>{e.nome}</b>
                        <small>{e.situacao === 'implantacao' ? `Implantação ${p.percentual}% · próximo: ${p.proximo?.titulo ?? '—'}` : `${ROTULO_SITUACAO[e.situacao]} · ${PLANOS[e.plano]} · ${uso.get(e.id)?.processos ?? 0} processos`}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          {sel === 'novo' ? <NovoEscritorio aoCriar={(id) => { carregar().then(() => setSel(id)); }} />
            : atual ? <FichaEscritorio key={atual.id} e={atual} uso={uso.get(atual.id)} aoMudar={carregar} />
            : (
              <div className="cartao vazio-plat">
                <PreviaMarca marca={{ ...MARCA_PADRAO }} />
                <p className="mudo">Escolha um escritório na lista ou crie um novo. O roteiro de implantação tem {PASSOS_IMPLANTACAO.length} passos e cabe em {duracao(MINUTOS_PREVISTOS)}.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );

  if (!sozinha) return corpo;
  return (
    <div className="plataforma-sozinha">
      <header className="plat-topo">
        <span className="marca"><img src="/logo.png" width={30} height={30} alt="" /><b>{PRODUTO}</b></span>
        <button className="btn pequeno" onClick={() => sair()}>Sair</button>
      </header>
      <main className="principal">{corpo}</main>
    </div>
  );
}
