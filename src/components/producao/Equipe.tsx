// Aba "Relatórios da equipe" (só administrador): quem entregou o relatório do dia, quem está pendente e o que cada um fez.
import { useState } from 'react';
import { RelatorioDiario, useBanco } from '../../store';
import { DataISO, hoje } from '../../lib/datas';
import { ehDiaUtil, formatarMinutos, idRelatorio, itensDoPeriodo, somaMinutos, somaPontos } from '../../lib/producao';
import { Segmentos, Stat, Vazio } from '../ui';
import { Avatar, equipeDe, horaDe, NavegadorData, porcentagem } from './Comum';

type Filtro = 'todos' | 'pendentes' | 'entregues';

function Situacao({ rel, cobra }: { rel?: RelatorioDiario; cobra: boolean }) {
  if (rel) return <span className="situacao ok"><i />Entregue às {horaDe(rel.entregueEm)}</span>;
  return cobra ? <span className="situacao pendente"><i />Pendente</span> : <span className="situacao"><i />Sem relatório</span>;
}

export default function Equipe({ data, aoMudarData, abrirDia }: { data: DataISO; aoMudarData: (d: DataISO) => void; abrirDia: (usuarioId: string) => void }) {
  const b = useBanco();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const cobra = ehDiaUtil(data) && data <= hoje();
  const itensDia = itensDoPeriodo(b, data, data);
  const linhas = equipeDe(b)
    .map((u) => ({ u, itens: itensDia.filter((i) => i.usuarioId === u.id), rel: b.relatoriosDiarios.find((r) => r.id === idRelatorio(u.id, data)) }))
    .sort((x, y) => Number(!!x.rel) - Number(!!y.rel) || x.u.nome.localeCompare(y.u.nome));
  const entregues = linhas.filter((l) => l.rel).length;
  const pendentes = linhas.length - entregues;
  const visiveis = linhas.filter((l) => filtro === 'todos' || (filtro === 'entregues' ? !!l.rel : !l.rel));

  return (
    <>
      <div className="prod-barra">
        <NavegadorData data={data} aoMudar={aoMudarData} />
        <Segmentos
          valor={filtro} aoMudar={setFiltro}
          opcoes={[['todos', `Todos · ${linhas.length}`], ['pendentes', `Pendentes · ${pendentes}`], ['entregues', `Entregues · ${entregues}`]]}
        />
      </div>

      <div className="grade g4 manter">
        <Stat rotulo="Relatórios entregues" valor={<>{entregues}<span className="valor-de"> de {linhas.length}</span></>} detalhe={linhas.length ? `${porcentagem(entregues / linhas.length)} da equipe` : undefined} />
        <Stat rotulo="Pendentes" valor={cobra ? pendentes : '—'} detalhe={cobra ? 'Ainda sem relatório hoje' : 'Dia sem expediente'} />
        <Stat rotulo="Pontos da equipe" valor={somaPontos(itensDia)} detalhe={`${itensDia.filter((i) => i.concluido).length} entregas concluídas`} />
        <Stat rotulo="Tempo registrado" valor={formatarMinutos(somaMinutos(itensDia))} />
      </div>

      <div className="cartao secao tabela-wrap">
        <div className="cartao-cab"><h3>Relatórios do dia</h3></div>
        {visiveis.length === 0 ? (
          <Vazio>{filtro === 'pendentes' ? 'Ninguém pendente neste dia.' : 'Nenhum relatório entregue neste dia.'}</Vazio>
        ) : (
          <table className="tabela-relatorios">
            <thead>
              <tr>
                <th>Pessoa</th><th>Situação</th><th className="dir">Entregas</th><th className="dir">Pontos</th><th className="dir">Tempo</th><th aria-label="Ações" />
              </tr>
            </thead>
            {visiveis.map(({ u, itens, rel }) => (
              <tbody key={u.id}>
                <tr className={rel ? 'com-resumo' : ''}>
                  <td><span className="pessoa"><Avatar b={b} id={u.id} tamanho={28} /><strong>{u.nome}</strong></span></td>
                  <td><Situacao rel={rel} cobra={cobra} /></td>
                  <td className="num dir">{itens.filter((i) => i.concluido).length}</td>
                  <td className="num dir">{somaPontos(itens)}</td>
                  <td className="num dir">{formatarMinutos(somaMinutos(itens))}</td>
                  <td className="dir"><button className="btn pequeno fantasma" onClick={() => abrirDia(u.id)}>Abrir dia</button></td>
                </tr>
                {rel && (
                  <tr className="linha-resumo">
                    <td colSpan={6}>
                      <dl className="resumo-relatorio">
                        <div><dt>O que foi feito</dt><dd>{rel.resumo}</dd></div>
                        {rel.pendencias && <div><dt>Pendências</dt><dd>{rel.pendencias}</dd></div>}
                        {rel.amanha && <div><dt>Plano para amanhã</dt><dd>{rel.amanha}</dd></div>}
                      </dl>
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        )}
      </div>
    </>
  );
}
