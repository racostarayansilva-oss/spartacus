// Clientes: cadastro e dossiê. A lista filtra por corretor, benefício e documentos pendentes;
// o dossiê de cada um abre em /clientes?cliente=<id>.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Beneficio, Cliente, useBanco } from '../store';
import { mascararCpf, somenteDigitos } from '../lib/cpf';
import { hoje } from '../lib/datas';
import { analiseIdade, BENEFICIOS, pendentes } from '../lib/dossie';
import { normalizar } from '../lib/importacao';
import { Icone } from '../components/icones';
import { Paginacao, Segmentos, Stat, Topo, Vazio } from '../components/ui';
import Dossie from '../components/clientes/Dossie';
import FormCliente from '../components/clientes/FormCliente';

type Docs = 'todos' | 'pendentes' | 'completos';
const SEM_CORRETOR = '__sem';

function Documentos({ c }: { c: Cliente }) {
  const total = c.documentos?.length ?? 0;
  const faltam = pendentes(c).length;
  if (!total) return <span className="situacao"><i />Sem lista</span>;
  if (!faltam) return <span className="situacao ok"><i />Completos</span>;
  return <span className="situacao pendente"><i />{faltam} faltando</span>;
}

export default function Clientes() {
  const b = useBanco();
  const [params, setParams] = useSearchParams();
  const [novo, setNovo] = useState(() => new URLSearchParams(window.location.search).get('novo') === '1');
  const [busca, setBusca] = useState('');
  const [corretor, setCorretor] = useState('');
  const [beneficio, setBeneficio] = useState<Beneficio | ''>('');
  const [docs, setDocs] = useState<Docs>('todos');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const h = hoje();

  const aberto = b.clientes.find((c) => c.id === params.get('cliente'));
  const abrir = (id: string) => setParams({ cliente: id });

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    const digitos = somenteDigitos(busca);
    return b.clientes
      .filter((c) => {
        if (q && !normalizar(`${c.nome} ${c.cidade ?? ''}`).includes(q) && !(digitos.length >= 3 && c.cpf.includes(digitos))) return false;
        if (corretor === SEM_CORRETOR ? !!c.corretorId : corretor && c.corretorId !== corretor) return false;
        if (beneficio && c.beneficio !== beneficio) return false;
        if (docs === 'pendentes' && !pendentes(c).length) return false;
        if (docs === 'completos' && (!c.documentos?.length || pendentes(c).length)) return false;
        return true;
      })
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  }, [b.clientes, busca, corretor, beneficio, docs]);

  if (aberto) return <Dossie cliente={aberto} aoVoltar={() => setParams({})} />;

  const mudarFiltro = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPagina(1); };
  const comPendencia = b.clientes.filter((c) => pendentes(c).length).length;
  const comCorretor = b.clientes.filter((c) => c.corretorId).length;
  const doMes = b.clientes.filter((c) => c.criadoEm?.slice(0, 7) === h.slice(0, 7)).length;
  const pag = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);
  const temFiltro = busca || corretor || beneficio || docs !== 'todos';

  return (
    <>
      <Topo titulo="Clientes" subtitulo="Cadastro e dossiê de cada cliente.">
        <button className="btn primario" onClick={() => setNovo(true)}><Icone nome="mais" tamanho={16} />Novo cliente</button>
      </Topo>

      <div className="grade g4 manter">
        <Stat rotulo="Clientes cadastrados" valor={b.clientes.length.toLocaleString('pt-BR')} />
        <Stat rotulo="Com documentos faltando" valor={comPendencia.toLocaleString('pt-BR')} />
        <Stat rotulo="Vindos de corretor" valor={comCorretor.toLocaleString('pt-BR')} detalhe={`${b.corretores.length} corretores cadastrados`} />
        <Stat rotulo="Cadastrados neste mês" valor={doMes.toLocaleString('pt-BR')} />
      </div>

      <div className="cartao secao">
        <div className="filtros-clientes">
          <div className="busca-campo">
            <Icone nome="busca" tamanho={16} />
            <input value={busca} onChange={(e) => mudarFiltro(setBusca)(e.target.value)} placeholder="Buscar por nome, CPF ou cidade" aria-label="Buscar cliente" />
          </div>
          <select value={corretor} onChange={(e) => mudarFiltro(setCorretor)(e.target.value)} aria-label="Corretor">
            <option value="">Todos os corretores</option>
            <option value={SEM_CORRETOR}>Sem corretor</option>
            {[...b.corretores].sort((x, y) => x.nome.localeCompare(y.nome)).map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
          <select value={beneficio} onChange={(e) => mudarFiltro(setBeneficio)(e.target.value as Beneficio | '')} aria-label="Benefício">
            <option value="">Todos os benefícios</option>
            {(Object.keys(BENEFICIOS) as Beneficio[]).map((k) => <option key={k} value={k}>{BENEFICIOS[k].rotulo}</option>)}
          </select>
          <Segmentos valor={docs} aoMudar={mudarFiltro(setDocs)} opcoes={[['todos', 'Todos'], ['pendentes', 'Faltando documentos'], ['completos', 'Completos']]} />
        </div>

        {filtrados.length === 0 ? (
          <div className="clientes-vazio">
            <Vazio>{temFiltro ? 'Nenhum cliente com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}</Vazio>
            {!temFiltro && <button className="btn" onClick={() => setNovo(true)}><Icone nome="mais" tamanho={16} />Cadastrar o primeiro</button>}
          </div>
        ) : (
          <>
            <div className="tabela-wrap">
              <table className="tabela-clientes">
                <thead>
                  <tr><th>Cliente</th><th>Benefício</th><th>Cidade</th><th>Corretor</th><th className="dir">Idade</th><th>Documentos</th></tr>
                </thead>
                <tbody>
                  {pag.map((c) => {
                    const a = analiseIdade(c, h);
                    return (
                      <tr key={c.id} className="clicavel" onClick={() => abrir(c.id)} onKeyDown={(e) => e.key === 'Enter' && abrir(c.id)} tabIndex={0}>
                        <td>
                          <div className="cli-nome">{c.nome}</div>
                          <div className="cli-sub mono">{c.cpf ? mascararCpf(c.cpf) : 'CPF não informado'}{c.telefone && <span> · {c.telefone}</span>}</div>
                        </td>
                        <td>{c.beneficio ? BENEFICIOS[c.beneficio].rotulo : <span className="sem-dado">—</span>}</td>
                        <td>{[c.cidade, c.uf].filter(Boolean).join(' - ') || <span className="sem-dado">—</span>}</td>
                        <td>{b.corretores.find((k) => k.id === c.corretorId)?.nome ?? <span className="sem-dado">—</span>}</td>
                        <td className="num dir">
                          {a ? a.idade : <span className="sem-dado">—</span>}
                          {a?.situacao === 'falta' && <div className="cli-sub">{a.idadeMinima} em {a.completaEm!.slice(0, 4)}</div>}
                        </td>
                        <td><Documentos c={c} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginacao total={filtrados.length} pagina={pagina} porPagina={porPagina} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} nome="clientes" />
          </>
        )}
      </div>

      {novo && <FormCliente aoFechar={() => setNovo(false)} aoSalvar={abrir} />}
    </>
  );
}
