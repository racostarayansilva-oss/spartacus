// Processos → "Importar do Legis": cria os processos que faltam e atualiza valor da causa e fase.
import { useMemo, useState } from 'react';
import { alterar, novoId, nomeCliente, useBanco } from '../store';
import { hoje } from '../lib/datas';
import { moeda } from '../lib/honorarios';
import { planejarProcessosLegis, ProcessoLegis, processosDoRelatorio } from '../lib/importarProcessosLegis';
import { Modal } from './ui';

const ROTULO_FASE = { instrucao: 'instrução', recursal: 'recursal', execucao: 'execução' } as const;

export function ImportarProcessosLegis({ aoFechar }: { aoFechar: () => void }) {
  const b = useBanco();
  const [itens, setItens] = useState<ProcessoLegis[]>([]);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  const plano = useMemo(() => (itens.length ? planejarProcessosLegis(itens, b, () => 'previa', hoje()) : null), [itens, b]);

  const ler = async (lista: FileList | null) => {
    setErro(''); setFeito('');
    if (!lista?.length) return;
    try {
      const textos = [...new Set(await Promise.all(Array.from(lista).map((f) => f.text())))];
      const todos = new Map<string, ProcessoLegis>();
      for (const t of textos) for (const p of processosDoRelatorio(t)) if (!todos.has(p.digitos)) todos.set(p.digitos, p);
      if (!todos.size) throw new Error('Nenhum processo encontrado no arquivo.');
      setItens([...todos.values()]);
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const importar = () => {
    let r = { novos: 0, clientes: 0, atualizados: 0 };
    alterar((db) => {
      const p = planejarProcessosLegis(itens, db, novoId, hoje());
      db.clientes.push(...p.clientesNovos);
      db.processos.push(...p.processosNovos);
      const porId = new Map(db.processos.map((x) => [x.id, x]));
      for (const m of p.atualizados) {
        const x = porId.get(m.id);
        if (!x) continue;
        if (m.valor !== undefined) x.valor = m.valor;
        if (m.faseLegis) x.faseLegis = m.faseLegis;
      }
      r = { novos: p.processosNovos.length, clientes: p.clientesNovos.length, atualizados: p.atualizados.length };
    });
    setFeito(`${r.novos} processo(s) e ${r.clientes} cliente(s) cadastrados; ${r.atualizados} processo(s) atualizados.`);
    setItens([]);
  };

  const valorNovos = plano?.processosNovos.reduce((s, p) => s + p.valor, 0) || 0;
  const nomeDo = (clienteId: string) => plano?.clientesNovos.find((c) => c.id === clienteId)?.nome || nomeCliente(b, clienteId);

  return (
    <Modal titulo="Importar processos do Legis" aoFechar={aoFechar} largo>
      <div className="grade" style={{ gap: 12 }}>
        <p className="mudo" style={{ margin: 0 }}>
          No Legis, exporte o relatório de processos em CSV. Os processos que ainda não estão no Spartacus são cadastrados (com o cliente pelo nome do autor);
          os que já existem recebem o valor da causa e a fase do Legis. Pode importar de novo sem duplicar.
        </p>
        <input type="file" accept=".csv,text/csv" multiple onChange={(e) => ler(e.target.files)} aria-label="Relatório de processos do Legis (CSV)" />
        {erro && <div className="erro">{erro}</div>}
        {feito && <div className="aviso">{feito}</div>}
        {plano && (
          <>
            <div className="aviso">
              <b>{itens.length.toLocaleString('pt-BR')}</b> processo(s) no arquivo.<br />
              Novos: <b>{plano.processosNovos.length}</b> processo(s) ({moeda(valorNovos)} em valor da causa) e <b>{plano.clientesNovos.length}</b> cliente(s).<br />
              Já cadastrados: <b>{plano.atualizados.length}</b> com valor ou fase atualizados e {plano.semMudanca} sem mudança.
            </div>
            {plano.processosNovos.length > 0 && (
              <div className="tabela-wrap">
                <table>
                  <thead><tr><th>Número</th><th>Cliente</th><th>Fase</th><th className="num">Valor da causa</th></tr></thead>
                  <tbody>
                    {plano.processosNovos.slice(0, 12).map((p) => (
                      <tr key={p.numero}>
                        <td className="mono">{p.numero}</td>
                        <td>{nomeDo(p.clienteId)}<div className="mudo">{p.regiao}</div></td>
                        <td>{p.faseLegis ? ROTULO_FASE[p.faseLegis] : '—'}</td>
                        <td className="num">{p.valor ? moeda(p.valor) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plano.processosNovos.length > 12 && <p className="mudo" style={{ fontSize: 13 }}>…e mais {plano.processosNovos.length - 12}.</p>}
              </div>
            )}
            <div className="flex">
              <button className="btn primario" onClick={importar} disabled={!plano.processosNovos.length && !plano.atualizados.length}>Importar</button>
              <button className="btn" onClick={aoFechar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
