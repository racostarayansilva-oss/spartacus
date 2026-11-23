// Produção: atividades do dia, relatório diário obrigatório e painel mensal com ranking.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MODO_NUVEM, useBanco, usuarioAtual } from '../store';
import { producaoSemTabela } from '../nuvem';
import { hoje } from '../lib/datas';
import { ehDiaUtil, idRelatorio } from '../lib/producao';
import { Topo } from '../components/ui';
import MeuDia from '../components/producao/MeuDia';
import Equipe from '../components/producao/Equipe';
import Mensal from '../components/producao/Mensal';
import { equipeDe } from '../components/producao/Comum';

type Aba = 'dia' | 'equipe' | 'mensal';

export default function Producao() {
  const b = useBanco();
  const eu = usuarioAtual(b);
  const euId = eu?.id ?? '';
  const admin = eu?.papel === 'advogado';
  const [params, setParams] = useSearchParams();
  // Relatórios da equipe: só administrador (o Supabase também só entrega os relatórios dos outros a ele)
  const abas: Aba[] = admin ? ['dia', 'equipe', 'mensal'] : ['dia', 'mensal'];
  const aba: Aba = abas.find((a) => a === params.get('aba')) ?? 'dia';
  const irPara = (a: Aba) => setParams(a === 'dia' ? {} : { aba: a }, { replace: true });

  const [pessoaId, setPessoaId] = useState(euId);
  const [dataDia, setDataDia] = useState(hoje());
  const [dataEquipe, setDataEquipe] = useState(hoje());

  const h = hoje();
  const pendentesHoje = admin && ehDiaUtil(h) ? equipeDe(b).filter((u) => !b.relatoriosDiarios.some((r) => r.id === idRelatorio(u.id, h))).length : 0;
  const meuPendente = ehDiaUtil(h) && !b.relatoriosDiarios.some((r) => r.id === idRelatorio(euId, h));

  return (
    <>
      <Topo titulo="Produção" subtitulo="Atividades do dia, relatório diário e desempenho da equipe." />

      {MODO_NUVEM && producaoSemTabela() && (
        <div className="erro" style={{ marginBottom: 16 }}>
          As tabelas da Produção ainda não existem no Supabase, então o que for lançado aqui <b>não fica salvo</b>.
          Rode de novo o arquivo <span className="mono">supabase/schema.sql</span> no SQL Editor (não apaga dados) e recarregue a página.
        </div>
      )}

      <div className="abas" role="tablist">
        <button role="tab" aria-selected={aba === 'dia'} className={aba === 'dia' ? 'ativo' : ''} onClick={() => irPara('dia')}>
          Meu dia{meuPendente && <span className="ponto-alerta" title="Seu relatório de hoje está pendente" />}
        </button>
        {admin && (
          <button role="tab" aria-selected={aba === 'equipe'} className={aba === 'equipe' ? 'ativo' : ''} onClick={() => irPara('equipe')}>
            Relatórios da equipe{pendentesHoje > 0 && <span className="contador">{pendentesHoje} {pendentesHoje === 1 ? 'pendente' : 'pendentes'}</span>}
          </button>
        )}
        <button role="tab" aria-selected={aba === 'mensal'} className={aba === 'mensal' ? 'ativo' : ''} onClick={() => irPara('mensal')}>
          Painel mensal
        </button>
      </div>

      {aba === 'dia' && (
        <MeuDia pessoaId={pessoaId || euId} aoMudarPessoa={setPessoaId} data={dataDia} aoMudarData={setDataDia} euId={euId} admin={admin} />
      )}
      {aba === 'equipe' && (
        <Equipe data={dataEquipe} aoMudarData={setDataEquipe} abrirDia={(id) => { setPessoaId(id); setDataDia(dataEquipe); irPara('dia'); }} />
      )}
      {aba === 'mensal' && <Mensal admin={admin} euId={euId} />}
    </>
  );
}
