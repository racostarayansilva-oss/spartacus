import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banco, nomeCliente, nomeCorretor, Processo, useBanco, usuarioAtual } from '../store';
import { faseAtual, ROTULO_TIPO, TipoProcesso } from '../lib/etapas';
import { triagemGrupoFamiliar } from '../lib/triagem';
import { formatar, hoje } from '../lib/datas';
import { moeda } from '../lib/honorarios';
import { partesDoAssunto } from '../lib/processos';

import { cortar, Paginacao, Stat, Topo, Vazio } from '../components/ui';
import { ImportarOab } from './ImportarOab';
import { ImportarProcessosLegis } from '../components/ImportarProcessosLegis';
import { baixarXlsx } from '../lib/xlsx';
import { abaProcessos } from '../lib/exportarProcessos';
import { AbaEtiquetas, ChipEtiqueta, etiquetasDoProcesso } from '../components/Etiquetas';
import { FormProcesso } from '../components/FormProcesso';
import { RevisarFases } from '../components/RevisarFases';
import { sugestoesDoBanco } from '../lib/fases';

/** Data da última movimentação conhecida (DJEN/DataJud ou etapa registrada). */
export function ultimaMovimentacao(p: Processo): string {
  const oficial = p.movimentosOficiais?.[0]?.data?.slice(0, 10) || '';
  const etapa = [...p.etapas].sort((a, b) => b.data.localeCompare(a.data))[0]?.data || '';
  return oficial > etapa ? oficial : etapa;
}

export default function Processos() {
  const b = useBanco();
  const [aba, setAba] = useState<'processos' | 'fases' | 'importacoes' | 'etiquetas'>('processos');
  const [params] = useSearchParams();
  const [etiqueta, setEtiqueta] = useState(params.get('etiqueta') || '');
  const etiquetaNaUrl = params.get('etiqueta');
  useEffect(() => { if (etiquetaNaUrl) { setEtiqueta(etiquetaNaUrl); setAba('processos'); } }, [etiquetaNaUrl]);
  const [importar, setImportar] = useState(false);
  const [importarLegis, setImportarLegis] = useState(false);
  const [novo, setNovo] = useState(() => new URLSearchParams(window.location.search).get('novo') === '1');
  const nav = useNavigate();
  const importacoes = b.config.importacoes || [];
  // Só muda quando processos ou intimações mudam
  const sugestoesFase = useMemo(() => sugestoesDoBanco(b), [b.processos, b.intimacoes]);


  return (
    <>
      <Topo titulo="Processos e Casos" subtitulo="Judiciais (JEF, cível, trabalhista) e requerimentos administrativos do INSS numa base única.">
        <button className="btn" onClick={() => setImportar(true)}>Importar pela OAB</button>
        {usuarioAtual(b)?.papel === 'advogado' && <button className="btn" onClick={() => setImportarLegis(true)}>Importar do Legis</button>}
        <button className="btn primario" onClick={() => setNovo(true)}>+ Novo processo</button>
      </Topo>
      <div className="abas" role="tablist">
        <button role="tab" className={aba === 'processos' ? 'ativo' : ''} onClick={() => setAba('processos')}>
          Processos e Casos<span className="contador">{b.processos.length}</span>
        </button>
        <button role="tab" className={aba === 'fases' ? 'ativo' : ''} onClick={() => setAba('fases')}>
          Revisar fases<span className="contador">{sugestoesFase.length}</span>
        </button>
        <button role="tab" className={aba === 'importacoes' ? 'ativo' : ''} onClick={() => setAba('importacoes')}>
          Importações<span className="contador">{importacoes.length}</span>
        </button>
        <button role="tab" className={aba === 'etiquetas' ? 'ativo' : ''} onClick={() => setAba('etiquetas')}>
          Etiquetas<span className="contador">{(b.config.etiquetas || []).length}</span>
        </button>
      </div>

      {aba === 'processos' && <ListaProcessos b={b} etiqueta={etiqueta} aoMudarEtiqueta={setEtiqueta} />}
      {aba === 'fases' && <RevisarFases b={b} itens={sugestoesFase} />}
      {aba === 'importacoes' && <Importacoes b={b} aoImportar={() => setImportar(true)} />}
      {aba === 'etiquetas' && <AbaEtiquetas b={b} aoFiltrar={(id) => { setEtiqueta(id); setAba('processos'); }} />}

      {importar && <ImportarOab aoFechar={() => setImportar(false)} />}
      {importarLegis && <ImportarProcessosLegis aoFechar={() => setImportarLegis(false)} />}
      {novo && <FormProcesso aoFechar={() => setNovo(false)} aoSalvar={(id) => nav(`/processos/${id}`)} />}
    </>
  );
}

function ListaProcessos({ b, etiqueta, aoMudarEtiqueta }: { b: Banco; etiqueta: string; aoMudarEtiqueta: (id: string) => void }) {
  const nav = useNavigate();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<TipoProcesso | ''>('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  const t = normalizarBusca(busca);
  const lista = useMemo(() => {
    const filtrados = b.processos.filter(
      (p) => (!tipo || p.tipo === tipo) && (!etiqueta || (p.etiquetas || []).includes(etiqueta)) && (!t || normalizarBusca(`${p.numero} ${p.numero.replace(/\D/g, '')} ${nomeCliente(b, p.clienteId)} ${p.assunto} ${p.regiao}`).includes(t)),
    );
    // Mais recentes primeiro, como no Legis
    return filtrados.map((p) => ({ p, ultima: ultimaMovimentacao(p) })).sort((x, y) => y.ultima.localeCompare(x.ultima));
  }, [b, t, tipo, etiqueta]);

  const ind = useMemo(() => indicadores(b), [b]);
  const inicio = (Math.min(pagina, Math.max(1, Math.ceil(lista.length / porPagina))) - 1) * porPagina;
  const visiveis = lista.slice(inicio, inicio + porPagina);

  return (
    <>
      <div className="grade g4 manter">
        <Stat rotulo="Aposentadorias rurais possíveis" valor={ind.aposentadoria} detalhe={`${ind.aposentadoriaProx} completam em até 5 anos`} />
        <Stat rotulo="Salários-maternidade possíveis" valor={ind.maternidade} detalhe="partos em 5 anos + gestantes" />
        <Stat rotulo="BPC idoso possível" valor={ind.bpc} detalhe="65 anos ou mais" />
        <Stat rotulo="Corretores ativos" valor={ind.corretoresAtivos} />
      </div>

      <div className="cartao secao">
        <div className="flex" style={{ marginBottom: 12 }}>
          <input placeholder="Buscar por número, cliente, assunto ou vara…" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} style={{ flex: '1 1 260px' }} />
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoProcesso | ''); setPagina(1); }} style={{ width: 'auto' }}>
            <option value="">Tipo: todos</option>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select value={etiqueta} onChange={(e) => { aoMudarEtiqueta(e.target.value); setPagina(1); }} style={{ width: 'auto' }}>
            <option value="">Etiqueta: todas</option>
            {(b.config.etiquetas || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <span className="etiqueta">Processos encontrados <strong className="num" style={{ color: 'var(--primario)' }}>{lista.length}</strong></span>
          <button className="btn pequeno" disabled={!lista.length} title="Baixa os processos desta lista (com os filtros aplicados)"
            onClick={() => baixarXlsx(`processos-${hoje()}.xlsx`, [abaProcessos(b, lista.map((x) => x.p), ultimaMovimentacao)])}>
            Exportar Excel
          </button>
        </div>
        <div className="tabela-wrap">
          {lista.length === 0 ? <Vazio>Nenhum processo encontrado.</Vazio> : (
            <table>
              <thead><tr><th>Título</th><th>Tipo</th><th>Fase</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
              <tbody>
                {visiveis.map(({ p, ultima }) => {
                  const { classe, contra } = partesDoAssunto(p.assunto);
                  const cliente = nomeCliente(b, p.clienteId);
                  return (
                    <tr key={p.id} className="clicavel" onClick={() => nav(`/processos/${p.id}`)}>
                      <td style={{ minWidth: 320 }}>
                        {/* Só autor x réu; o limite evita que um texto grudado no nome tome a linha */}
                        <div className="proc-titulo">{cortar(cliente, 80)}{contra ? ` x ${cortar(contra, 80)}` : ''}</div>
                        <div className="proc-meta">
                          <span className="mono">#{p.numero}</span>
                          {ultima && <span className="num">{formatar(ultima)}</span>}
                          {p.regiao && <span>{cortar(p.regiao, 60)}</span>}
                          {p.corretorId && <span>Corretor: {nomeCorretor(b, p.corretorId)}</span>}
                        </div>
                        {classe && <div className="proc-assunto" title={p.assunto}>{cortar(classe, 120)}</div>}
                        {(p.etiquetas || []).length > 0 && (
                          <div className="flex" style={{ marginTop: 6, gap: 4 }}>{etiquetasDoProcesso(b, p).map((e) => <ChipEtiqueta key={e.id} e={e} />)}</div>
                        )}
                      </td>
                      <td><span className="etiqueta violeta">{ROTULO_TIPO[p.tipo]}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{faseAtual(p.etapas)}</td>
                      <td className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{p.valor ? moeda(p.valor) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Paginacao total={lista.length} pagina={pagina} porPagina={porPagina} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} nome="processos" />
      </div>

      <CorretoresRegioes b={b} />
    </>
  );
}

function Importacoes({ b, aoImportar }: { b: Banco; aoImportar: () => void }) {
  const lista = [...(b.config.importacoes || [])].sort((x, y) => y.em.localeCompare(x.em));
  return (
    <div className="cartao">
      <div className="cartao-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>Importações</h3>
          <div className="mudo">Histórico das buscas de processos pela OAB: quem fez, quando e quantos processos entraram.</div>
        </div>
        <button className="btn primario" onClick={aoImportar}>Importar pela OAB</button>
      </div>
      <div className="tabela-wrap mt">
        {lista.length === 0 ? <Vazio>Nenhuma importação ainda.</Vazio> : (
          <table>
            <thead><tr><th>Data</th><th>Conta</th><th>Fonte</th><th>Período das comunicações</th><th style={{ textAlign: 'right' }}>Processos novos</th><th style={{ textAlign: 'right' }}>Clientes novos</th><th style={{ textAlign: 'right' }}>Já existiam</th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{formatar(r.em.slice(0, 10))} {r.em.slice(11, 16)}</td>
                  <td><strong>{r.usuarioNome}</strong></td>
                  <td>{r.fonte}<div className="mudo">{r.oabs.join(' · ')}</div>{r.observacao && <div className="mudo">{r.observacao}</div>}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.periodo ? `${formatar(r.periodo.inicio)} a ${formatar(r.periodo.fim)}` : '—'}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--primario)', fontWeight: 700 }}>{r.processosNovos}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{r.clientesNovos}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{r.jaExistentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const normalizarBusca = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function indicadores(b: Banco) {
  const h = hoje();
  let aposentadoria = 0, aposentadoriaProx = 0, maternidade = 0, bpc = 0;
  for (const p of b.processos) {
    const r = triagemGrupoFamiliar(p.grupoFamiliar, h);
    aposentadoria += r.aposentadoriaRural.filter((x) => x.situacao === 'atingiu').length;
    aposentadoriaProx += r.aposentadoriaRural.filter((x) => x.situacao === 'proximos5anos').length;
    maternidade += r.salarioMaternidade.length;
    bpc += r.bpcIdoso.length;
  }
  const corretoresAtivos = new Set(b.processos.map((p) => p.corretorId).filter(Boolean)).size;
  return { aposentadoria, aposentadoriaProx, maternidade, bpc, corretoresAtivos };
}

function CorretoresRegioes({ b }: { b: Banco }) {
  const linhas = b.corretores.map((k) => {
    const procs = b.processos.filter((p) => p.corretorId === k.id);
    const procedentes = procs.filter(
      (p) =>
        p.etapas.some((e) => e.etapa === 'Sentença' && e.resultado === 'procedente') ||
        b.registros.some((r) => r.processoId === p.id && r.tipo === 'sentenca' && r.resultado === 'procedente'),
    ).length;
    const regioes = [...new Set([...k.regioes, ...procs.map((p) => p.regiao)])];
    return { k, procs: procs.length, procedentes, regioes };
  });
  return (
    <div className="cartao secao tabela-wrap">
      <h3>Corretores e regiões</h3>
      <table>
        <thead><tr><th>Corretor</th><th>Regiões</th><th>Processos</th><th>Sentenças procedentes</th></tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.k.id}>
              <td>{l.k.nome}<div className="mudo num">{l.k.telefone}</div></td>
              <td>{l.regioes.map((r) => <span key={r} className="etiqueta" style={{ marginRight: 4 }}>{r}</span>)}</td>
              <td className="num">{l.procs}</td>
              <td className="num">{l.procedentes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
