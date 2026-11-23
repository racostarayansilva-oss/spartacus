// Indicadores do CNIS: consulta por sigla e leitura de um CNIS colado, apontando o que precisa de tratamento.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../components/icones';
import { Segmentos, Topo, Vazio } from '../components/ui';
import { detectar, IndicadorCnis, INDICADORES, ROTULO_CONTA, ROTULO_TIPO, TipoIndicador } from '../lib/cnis';
import { normalizar } from '../lib/importacao';

function Ficha({ ind, vezes }: { ind: IndicadorCnis; vezes?: number }) {
  return (
    <article className="cnis-ficha">
      <header>
        <span className="cnis-sigla mono">{ind.sigla}</span>
        <span className={`cnis-tipo ${ind.tipo}`}>{ROTULO_TIPO[ind.tipo]}</span>
        {vezes !== undefined && <span className="mudo num">{vezes}× no CNIS</span>}
        <span className={`situacao ${ind.conta === 'nao' ? 'bloqueia' : ind.conta === 'sim' ? 'ok' : 'pendente'}`}><i />{ROTULO_CONTA[ind.conta]}</span>
      </header>
      <h3>{ind.descricao}</h3>
      <p>{ind.significa}</p>
      <div className="cnis-fazer">
        <span className="rotulo-campo">O que fazer</span>
        <ul>{ind.fazer.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      <footer className="mudo">{ind.grupo}</footer>
    </article>
  );
}

export default function IndicadoresCnis() {
  const [aba, setAba] = useState<'consultar' | 'analisar'>('consultar');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<TipoIndicador | ''>('');
  const [texto, setTexto] = useState('');

  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return INDICADORES.filter((i) => (!tipo || i.tipo === tipo) && (!q || normalizar(`${i.sigla} ${i.descricao} ${i.significa}`).includes(q)));
  }, [busca, tipo]);
  const achados = useMemo(() => detectar(texto), [texto]);
  const bloqueiam = achados.filter((a) => a.ind.conta === 'nao').length;

  return (
    <>
      <Link to="/" className="btn fantasma pequeno voltar"><Icone nome="seta-esq" tamanho={15} />Área de trabalho</Link>
      <Topo titulo="Indicadores do CNIS" subtitulo="O que cada sigla significa, se o período conta e o que fazer para resolver." />

      <div className="abas">
        <button className={aba === 'consultar' ? 'ativo' : ''} onClick={() => setAba('consultar')}>Consultar sigla<span className="contador">{INDICADORES.length}</span></button>
        <button className={aba === 'analisar' ? 'ativo' : ''} onClick={() => setAba('analisar')}>Analisar CNIS do cliente</button>
      </div>

      {aba === 'consultar' ? (
        <>
          <div className="filtros-clientes">
            <div className="busca-campo">
              <Icone nome="busca" tamanho={16} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por sigla ou situação (ex.: PEXT, extemporâneo, baixa renda)" aria-label="Buscar indicador" autoFocus />
            </div>
            <Segmentos valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ['pendencia', 'Pendências'], ['indicador', 'Indicadores'], ['acerto', 'Acertos']]} />
          </div>
          {lista.length === 0 ? <div className="cartao"><Vazio>Nenhum indicador encontrado. Tente outra palavra.</Vazio></div> : (
            <div className="cnis-grade">{lista.map((i) => <Ficha key={i.sigla} ind={i} />)}</div>
          )}
        </>
      ) : (
        <>
          <div className="cartao">
            <label className="campo">
              Cole aqui o texto do extrato do CNIS (abra o PDF, selecione tudo com Ctrl+A e copie)
              <textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: 01/2018 1.200,00 PREC-MENOR-MIN ..." />
            </label>
            {texto.trim() && (
              <p className="cnis-resumo">
                {achados.length === 0
                  ? 'Nenhuma sigla conhecida encontrada neste texto.'
                  : <><b className="num">{achados.length}</b> indicador{achados.length > 1 ? 'es' : ''} encontrado{achados.length > 1 ? 's' : ''}{bloqueiam ? <>; <b className="num">{bloqueiam}</b> impede{bloqueiam > 1 ? 'm' : ''} a contagem do período até {bloqueiam > 1 ? 'serem resolvidos' : 'ser resolvido'}.</> : '.'}</>}
              </p>
            )}
          </div>
          {achados.length > 0 && <div className="cnis-grade secao">{achados.map((a) => <Ficha key={a.ind.sigla} ind={a.ind} vezes={a.vezes} />)}</div>}
        </>
      )}

      <p className="mudo pdf-ajuda secao">Descrições conforme o Manual de Indicadores do CNIS (INSS). Confira sempre o detalhamento no extrato antes de orientar o cliente.</p>
    </>
  );
}
