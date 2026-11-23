// Aba "Painel mensal": pontos por dia, ranking, distribuição por tipo e detalhamento exportável.
// Relatórios e assiduidade de cada pessoa só aparecem para o administrador.
import { useMemo, useState } from 'react';
import { useBanco } from '../../store';
import { hoje } from '../../lib/datas';
import {
  csvDoMes, diaCurto, ehDiaUtil, formatarMinutos, intervaloDoMes, itensDoPeriodo, mesVizinho, nomeDoMes,
  pontosPorDia, porTipo, ranking, somaMinutos, somaPontos,
} from '../../lib/producao';
import { Icone } from '../icones';
import { Stat, Vazio } from '../ui';
import { Avatar, entregas, porcentagem } from './Comum';

const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function Mensal({ admin, euId }: { admin: boolean; euId: string }) {
  const b = useBanco();
  const h = hoje();
  const [mes, setMes] = useState(h.slice(0, 7));
  const [inicio, fim] = intervaloDoMes(mes);
  const [iniAnt, fimAnt] = intervaloDoMes(mesVizinho(mes, -1));

  const itens = useMemo(() => itensDoPeriodo(b, inicio, fim), [b, inicio, fim]);
  const linhas = useMemo(() => ranking(b, inicio, fim, h), [b, inicio, fim, h]);
  const pontosAnt = useMemo(() => somaPontos(itensDoPeriodo(b, iniAnt, fimAnt)), [b, iniAnt, fimAnt]);
  const dias = pontosPorDia(itens, inicio, fim);
  const tipos = porTipo(itens.filter((i) => i.concluido));

  const pontos = somaPontos(itens);
  const concluidas = itens.filter((i) => i.concluido).length;
  const automaticas = itens.filter((i) => i.origem !== 'atividade').length;
  const variacao = pontosAnt ? (pontos - pontosAnt) / pontosAnt : null;
  const diasUteisPassados = dias.filter((d) => d.data <= h && ehDiaUtil(d.data)).length;
  const media = diasUteisPassados ? pontos / diasUteisPassados : 0;
  const lider = linhas[0]?.pontos || 1;
  const eu = linhas.find((l) => l.usuarioId === euId);
  const minhaPosicao = linhas.findIndex((l) => l.usuarioId === euId) + 1;
  const relatorios = linhas.reduce((s, l) => s + l.relatorios, 0);
  const esperados = linhas.reduce((s, l) => s + l.diasEsperados, 0);
  const mesAnterior = nomeDoMes(mesVizinho(mes, -1)).split(' ')[0].toLowerCase();

  const exportar = () => {
    const url = URL.createObjectURL(new Blob([csvDoMes(linhas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="prod-barra">
        <div className="nav-data">
          <button className="btn fantasma pequeno" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior"><Icone nome="seta-esq" tamanho={16} /></button>
          <span className="nav-data-rotulo">{nomeDoMes(mes)}</span>
          <button className="btn fantasma pequeno" onClick={() => setMes(mesVizinho(mes, 1))} disabled={mes >= h.slice(0, 7)} aria-label="Próximo mês"><Icone nome="seta-dir" tamanho={16} /></button>
        </div>
        {admin && <button className="btn" onClick={exportar} disabled={!linhas.length}><Icone nome="baixar" tamanho={16} />Exportar planilha</button>}
      </div>

      <div className="grade g4 manter">
        <Stat
          rotulo="Pontos da equipe" valor={pontos}
          detalhe={variacao === null ? `Sem pontos em ${mesAnterior}` : <><span className={variacao >= 0 ? 'seta-sobe' : 'seta-desce'}>{variacao >= 0 ? '▲' : '▼'}</span> {porcentagem(Math.abs(variacao))} em relação a {mesAnterior}</>}
        />
        <Stat rotulo="Entregas concluídas" valor={concluidas} detalhe={`${concluidas - automaticas} lançadas · ${automaticas} automáticas`} />
        <Stat rotulo="Horas registradas" valor={formatarMinutos(somaMinutos(itens))} detalhe={linhas.length ? `${formatarMinutos(Math.round(somaMinutos(itens) / linhas.length))} por pessoa` : undefined} />
        {admin ? (
          <Stat rotulo="Relatórios diários" valor={<>{relatorios}<span className="valor-de"> de {esperados}</span></>} detalhe={esperados ? `${porcentagem(relatorios / esperados)} de assiduidade da equipe` : 'Nenhum dia útil ainda'} />
        ) : (
          <Stat rotulo="Minha posição" valor={minhaPosicao ? <>{minhaPosicao}º<span className="valor-de"> de {linhas.length}</span></> : '—'} detalhe={eu ? `${eu.pontos} pts · ${eu.relatorios} de ${eu.diasEsperados} relatórios` : undefined} />
        )}
      </div>

      <div className="cartao secao">
        <div className="cartao-cab">
          <h3>Pontos por dia</h3>
          <span className="mudo">Média de <span className="num">{decimal(media)}</span> pts por dia útil</span>
        </div>
        <GraficoDias dias={dias} hoje={h} />
      </div>

      <div className="grade prod-mensal secao">
        <div className="cartao">
          <div className="cartao-cab"><h3>Ranking do mês</h3><span className="mudo">por pontos</span></div>
          {linhas.length === 0 ? <Vazio>Nenhuma pessoa da equipe cadastrada.</Vazio> : (
            <ol className="ranking">
              {linhas.map((l, i) => (
                <li key={l.usuarioId} className={l.usuarioId === euId ? 'eu' : ''}>
                  <span className={`rank-pos${i === 0 && l.pontos ? ' lider' : ''}`}>{i + 1}</span>
                  <Avatar b={b} id={l.usuarioId} />
                  <div className="rank-corpo">
                    <div className="rank-nome">
                      <strong>{l.nome}{l.usuarioId === euId && <span className="voce">você</span>}</strong>
                      <span className="num">{l.pontos} <small>pts</small></span>
                    </div>
                    <div className="medidor"><span style={{ width: `${(l.pontos / lider) * 100}%` }} /></div>
                    <div className="rank-meta">
                      <span>{entregas(l.concluidos)}</span>
                      <span>{formatarMinutos(l.minutos)}</span>
                      {(admin || l.usuarioId === euId) && <span>{l.relatorios} de {l.diasEsperados} relatórios</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="cartao">
          <div className="cartao-cab"><h3>Por tipo de entrega</h3><span className="mudo">pontos</span></div>
          {tipos.length === 0 ? <Vazio>Nenhuma entrega concluída neste mês.</Vazio> : (
            <ul className="por-tipo">
              {tipos.map((t) => (
                <li key={t.tipo}>
                  <div className="rank-nome">
                    <span>{t.tipo} <span className="qtd">{t.quantidade}×</span></span>
                    <span className="num">{t.pontos}</span>
                  </div>
                  <div className="medidor"><span style={{ width: `${(t.pontos / (tipos[0].pontos || 1)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="cartao secao tabela-wrap">
        <div className="cartao-cab"><h3>Detalhamento por pessoa</h3></div>
        <table className="tabela-producao">
          <thead>
            <tr>
              <th>Pessoa</th><th className="dir">Pontos</th><th className="dir">Entregas</th><th className="dir">Atividades</th>
              <th className="dir">Tarefas</th><th className="dir">Movimentações</th><th className="dir">Tempo</th>
              {admin && <><th className="dir">Relatórios</th><th className="dir">Assiduidade</th></>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.usuarioId} className={l.usuarioId === euId ? 'eu' : ''}>
                <td><span className="pessoa"><Avatar b={b} id={l.usuarioId} tamanho={24} />{l.nome}</span></td>
                <td className="num dir forte">{l.pontos}</td>
                <td className="num dir">{l.concluidos}</td>
                <td className="num dir">{l.atividades}</td>
                <td className="num dir">{l.tarefas}</td>
                <td className="num dir">{l.registros}</td>
                <td className="num dir">{formatarMinutos(l.minutos)}</td>
                {admin && (
                  <>
                    <td className="num dir">{l.relatorios} de {l.diasEsperados}</td>
                    <td className="dir">
                      <span className="assiduidade">
                        <span className="medidor curto"><span style={{ width: porcentagem(l.assiduidade) }} /></span>
                        <span className="num">{porcentagem(l.assiduidade)}</span>
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nota-tabela">
          Pontuação: petição e audiência valem 3; protocolo, diligência e pesquisa, 2; demais atividades, 1. Tarefas valem os pontos do quadro e movimentações de 1 a 3, conforme o tipo.
        </p>
      </div>
    </>
  );
}

/** Barras verticais de uma série só (pontos por dia). Fins de semana ficam numa faixa de fundo; passar o mouse mostra o valor. */
function GraficoDias({ dias, hoje: h }: { dias: { data: string; pontos: number; itens: number }[]; hoje: string }) {
  const max = Math.max(4, ...dias.map((d) => d.pontos));
  const topo = Math.ceil(max / 4) * 4;
  return (
    <div className="grafico-dias" role="img" aria-label={`Pontos por dia: ${dias.filter((d) => d.pontos).map((d) => `dia ${diaCurto(d.data)}, ${d.pontos}`).join('; ') || 'sem pontos no mês'}`}>
      <div className="grafico-eixo">
        {[topo, topo / 2, 0].map((v) => <span key={v} className="num">{v}</span>)}
      </div>
      <div className="grafico-area">
        <div className="grafico-grade"><span /><span /><span /></div>
        <div className="grafico-colunas" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
          {dias.map((d) => {
            const futuro = d.data > h;
            return (
              <div key={d.data} className={`grafico-col${ehDiaUtil(d.data) ? '' : ' fds'}${d.data === h ? ' hoje' : ''}${futuro ? ' futuro' : ''}`}>
                <div className="grafico-trilho">
                  {!futuro && d.pontos > 0 && <span className="grafico-barra" style={{ height: `${(d.pontos / topo) * 100}%` }} />}
                  {!futuro && (
                    <span className="grafico-dica">
                      <b>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</b><span>{d.pontos} pts · {d.itens} {d.itens === 1 ? 'item' : 'itens'}</span>
                    </span>
                  )}
                </div>
                <span className="grafico-rotulo num">{diaCurto(d.data)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
