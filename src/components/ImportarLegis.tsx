// Tarefas → "Importar do Legis": lê o CSV exportado, liga cada responsável a alguém da equipe e grava.
import { useMemo, useState } from 'react';
import { alterar, useBanco } from '../store';
import { LinhaLegis, linhasLegis, planejarLegis, responsaveisDoArquivo, sugerirUsuario } from '../lib/importarLegis';
import { Modal } from './ui';

export function ImportarLegis({ aoFechar }: { aoFechar: () => void }) {
  const b = useBanco();
  const equipe = b.usuarios.filter((u) => u.papel !== 'cliente');
  const [linhas, setLinhas] = useState<LinhaLegis[]>([]);
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [concluidas, setConcluidas] = useState(true);
  const [feito, setFeito] = useState('');

  const nomes = useMemo(() => responsaveisDoArquivo(linhas), [linhas]);
  const plano = useMemo(() => (linhas.length ? planejarLegis(linhas, b, mapa, new Date().toISOString(), concluidas) : null), [linhas, b, mapa, concluidas]);

  const ler = async (lista: FileList | null) => {
    setErro(''); setFeito('');
    if (!lista?.length) return;
    try {
      // Mesmo arquivo escolhido duas vezes não duplica (linhas iguais dentro de um arquivo são tarefas distintas)
      const textos = [...new Set(await Promise.all(Array.from(lista).map((f) => f.text())))];
      const unicas = textos.flatMap(linhasLegis);
      if (!unicas.length) throw new Error('Nenhuma tarefa encontrada no arquivo.');
      const salvo = b.config.responsaveisLegis || {};
      const novoMapa: Record<string, string> = {};
      for (const { nome } of responsaveisDoArquivo(unicas)) novoMapa[nome] = nome in salvo ? salvo[nome] : sugerirUsuario(nome, b.usuarios) || '';
      setLinhas(unicas);
      setArquivos(Array.from(lista).map((f) => f.name));
      setMapa(novoMapa);
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const importar = () => {
    if (!plano) return;
    const agora = new Date().toISOString();
    alterar((db) => {
      const p = planejarLegis(linhas, db, mapa, agora, concluidas);
      const porId = new Map(db.tarefas.map((t, i) => [t.id, i]));
      for (const t of p.tarefas) {
        const i = porId.get(t.id);
        if (i === undefined) db.tarefas.push(t); else db.tarefas[i] = t;
      }
      db.config.responsaveisLegis = { ...(db.config.responsaveisLegis || {}), ...mapa };
    });
    setFeito(`${plano.novas} tarefa(s) nova(s) e ${plano.atualizadas} atualizada(s). Ninguém foi notificado.`);
    setLinhas([]);
  };

  const situacoes = linhas.reduce<Record<string, number>>((s, l) => ({ ...s, [l.status || '—']: (s[l.status || '—'] || 0) + 1 }), {});

  return (
    <Modal titulo="Importar tarefas do Legis" aoFechar={aoFechar} largo>
      <div className="grade" style={{ gap: 12 }}>
        <p className="mudo" style={{ margin: 0 }}>
          No Legis, exporte o relatório de tarefas em CSV e escolha o arquivo aqui (pode escolher vários). Importar de novo o mesmo arquivo atualiza as tarefas, sem duplicar.
        </p>
        <input type="file" accept=".csv,text/csv" multiple onChange={(e) => ler(e.target.files)} aria-label="Arquivo CSV do Legis" />
        {erro && <div className="erro">{erro}</div>}
        {feito && <div className="aviso">{feito}</div>}

        {plano && (
          <>
            <div className="aviso">
              <b>{linhas.length}</b> tarefa(s) em {arquivos.join(', ')}: {Object.entries(situacoes).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ')}.
              <br />
              Vão entrar <b>{plano.novas}</b> nova(s) e <b>{plano.atualizadas}</b> já importada(s) serão atualizadas. <b>{plano.comProcesso}</b> ligada(s) a um processo do Spartacus
              {plano.semResponsavel ? <>; <b>{plano.semResponsavel}</b> ficariam sem responsável</> : ''}.
            </div>
            <label className="flex" style={{ gap: 8 }}>
              <input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} />
              Importar também as concluídas (histórico e pontos de produção)
            </label>

            <div>
              <h3 style={{ marginBottom: 4 }}>Quem é quem</h3>
              <p className="mudo" style={{ marginTop: 0, fontSize: 13 }}>O primeiro da lista vira o responsável; os outros, participantes. Nomes sem correspondência ficam anotados na descrição da tarefa.</p>
              <div className="tabela-wrap">
                <table>
                  <thead><tr><th>No Legis</th><th className="num">Tarefas</th><th>No Spartacus</th></tr></thead>
                  <tbody>
                    {nomes.map(({ nome, tarefas }) => (
                      <tr key={nome}>
                        <td>{nome}</td>
                        <td className="num">{tarefas}</td>
                        <td>
                          <select value={mapa[nome] || ''} onChange={(e) => setMapa({ ...mapa, [nome]: e.target.value })} aria-label={`Pessoa do Spartacus para ${nome}`}>
                            <option value="">Ninguém (só anotar)</option>
                            {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex">
              <button className="btn primario" onClick={importar}>Importar {plano.tarefas.length} tarefa(s)</button>
              <button className="btn" onClick={aoFechar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
