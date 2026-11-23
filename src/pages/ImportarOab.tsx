// Importar processos pela OAB: varre o DJEN (CNJ) ano a ano, página a página, respeitando o limite
// de 20 consultas por minuto, e cria os processos e clientes que ainda não existem.
import { useEffect, useRef, useState } from 'react';
import { alterar, novoId, useBanco, usuarioAtual } from '../store';
import { api } from '../api';
import { agruparPorProcesso, CLIENTE_A_IDENTIFICAR, ComunicacaoDjen, montarImportacao, ResultadoImportacao } from '../lib/importacao';
import { formatar, hoje, somarDias } from '../lib/datas';
import { ROTULO_TIPO } from '../lib/etapas';
import { Campo, Modal } from '../components/ui';

const INTERVALO_MS = 3200; // 20 consultas/minuto no DJEN
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fase = 'escolher' | 'varrendo' | 'revisar' | 'feito';

/** Quebra o período em janelas de até 1 ano (o DJEN responde melhor assim). */
function janelas(desde: string, ate: string): [string, string][] {
  const out: [string, string][] = [];
  let ini = desde;
  while (ini <= ate) {
    const fimAno = `${ini.slice(0, 4)}-12-31`;
    const fim = fimAno < ate ? fimAno : ate;
    out.push([ini, fim]);
    ini = somarDias(fim, 1);
  }
  return out.reverse(); // mais recentes primeiro
}

export function ImportarOab({ aoFechar }: { aoFechar: () => void }) {
  const b = useBanco();
  const [oabs, setOabs] = useState(() => b.config.oabs.map((o) => ({ ...o, marcada: true })));
  const [desde, setDesde] = useState('2023-01-01');
  const [fase, setFase] = useState<Fase>('escolher');
  const [prog, setProg] = useState({ feitas: 0, total: 0, comunicacoes: 0, processos: 0, etapa: '' });
  const [avisos, setAvisos] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importados, setImportados] = useState(0);
  const parar = useRef(false);
  const coms = useRef<ComunicacaoDjen[]>([]);

  useEffect(() => {
    if (fase !== 'varrendo') return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [fase]);

  const [incluirSemCliente, setIncluirSemCliente] = useState(true);
  const revisar = (incluir = incluirSemCliente) => {
    const encontrados = agruparPorProcesso(coms.current);
    // Sem responsável: quem importou fica registrado na aba Importações, não nos processos
    setResultado(montarImportacao(encontrados, b, novoId, '', 20, incluir));
    setFase('revisar');
  };

  const varrer = async () => {
    parar.current = false;
    coms.current = [];
    setAvisos([]);
    setFase('varrendo');
    const marcadas = oabs.filter((o) => o.marcada);
    const lista = marcadas.flatMap((o) => janelas(desde, hoje()).map((j) => ({ ...o, ini: j[0], fim: j[1] })));
    let feitas = 0;
    let totalPaginas = lista.length; // estimativa inicial: 1 página por janela
    const vistos = new Set<string>();
    let ultimo = 0;

    const pedir = async (o: (typeof lista)[0], pagina: number) => {
      for (let tentativa = 1; ; tentativa++) {
        const falta = ultimo + INTERVALO_MS - Date.now();
        if (falta > 0) await esperar(falta);
        ultimo = Date.now();
        try {
          return await api<{ total: number; itens: ComunicacaoDjen[] }>(
            `publicacoes/pagina?oab=${o.numero}&uf=${o.uf}&inicio=${o.ini}&fim=${o.fim}&pagina=${pagina}`,
          );
        } catch (e: any) {
          if (parar.current) throw e;
          const limite = /limite/i.test(e.message);
          if (tentativa >= 4) throw e;
          setProg((p) => ({ ...p, etapa: limite ? 'Limite do DJEN atingido; aguardando 1 minuto…' : `Falha (${e.message}); tentando de novo…` }));
          await esperar(limite ? 61_000 : 10_000);
        }
      }
    };

    for (const o of lista) {
      if (parar.current) break;
      const rotulo = `OAB/${o.uf} ${o.numero} · ${formatar(o.ini)} a ${formatar(o.fim)}`;
      try {
        let pagina = 1;
        let paginas = 1;
        do {
          setProg((p) => ({ ...p, etapa: `${rotulo} · página ${pagina} de ${paginas}` }));
          const r = await pedir(o, pagina);
          if (pagina === 1) {
            paginas = Math.max(1, Math.ceil(r.total / 100));
            totalPaginas += paginas - 1;
          }
          for (const c of r.itens) if (!vistos.has(c.id)) { vistos.add(c.id); coms.current.push(c); }
          feitas++;
          const nProc = new Set(coms.current.map((c) => c.processo.replace(/\D/g, ''))).size;
          setProg({ feitas, total: totalPaginas, comunicacoes: coms.current.length, processos: nProc, etapa: `${rotulo} · página ${pagina} de ${paginas}` });
          pagina++;
        } while (pagina <= paginas && !parar.current);
      } catch (e: any) {
        setAvisos((a) => [...a, `${rotulo}: ${e.message}`]);
      }
    }
    revisar();
  };

  const importar = () => {
    if (!resultado) return;
    const eu = usuarioAtual(b);
    alterar((db) => {
      db.clientes.push(...resultado.clientesNovos);
      db.processos.push(...resultado.processos);
      db.config.importacoes = [
        {
          id: novoId(),
          em: new Date().toISOString(),
          usuarioId: eu?.id || '',
          usuarioNome: eu?.nome || '—',
          fonte: 'OAB (DJEN/CNJ)',
          oabs: oabs.filter((o) => o.marcada).map((o) => `OAB/${o.uf} ${o.numero}`),
          periodo: { inicio: desde, fim: hoje() },
          processosNovos: resultado.processos.length,
          clientesNovos: resultado.clientesNovos.length,
          jaExistentes: resultado.jaExistentes,
        },
        ...(db.config.importacoes || []),
      ];
    });
    setImportados(resultado.processos.length);
    setFase('feito');
  };

  const minutos = Math.ceil(((prog.total - prog.feitas) * INTERVALO_MS) / 60_000);

  return (
    <Modal titulo="Importar processos pela OAB" aoFechar={fase === 'varrendo' ? () => undefined : aoFechar}>
      {fase === 'escolher' && (
        <>
          <p className="mudo" style={{ margin: 0 }}>
            Busca no DJEN (CNJ) todas as comunicações em que a OAB aparece, junta por número de processo e cria os processos e clientes que ainda não estão no RA Connect. Gratuito.
          </p>
          <div>
            <strong style={{ fontSize: '0.88rem' }}>OABs</strong>
            {oabs.map((o, i) => (
              <label key={o.uf + o.numero} className="check" style={{ display: 'flex', marginTop: 6 }}>
                <input type="checkbox" checked={o.marcada} onChange={(e) => setOabs(oabs.map((x, j) => (j === i ? { ...x, marcada: e.target.checked } : x)))} />
                OAB/{o.uf} {o.numero}
              </label>
            ))}
          </div>
          <Campo rotulo="Buscar comunicações desde">
            <select value={desde} onChange={(e) => setDesde(e.target.value)}>
              <option value="2023-01-01">2023 (todo o histórico do DJEN)</option>
              <option value="2025-01-01">2025</option>
              <option value={somarDias(hoje(), -365)}>Últimos 12 meses</option>
              <option value={somarDias(hoje(), -90)}>Últimos 3 meses</option>
            </select>
          </Campo>
          <div className="aviso">
            O DJEN só tem processos que tiveram alguma intimação no período. Processos parados há muito tempo, sem nenhuma comunicação desde {desde.slice(0, 4)}, não aparecem e precisam ser cadastrados à mão.
            A busca completa leva cerca de 10 minutos (limite de 20 consultas por minuto do CNJ). Deixe esta aba aberta.
          </div>
          <div className="modal-acoes">
            <button className="btn" onClick={aoFechar}>Cancelar</button>
            <button className="btn primario" onClick={varrer} disabled={!oabs.some((o) => o.marcada)}>Começar busca</button>
          </div>
        </>
      )}

      {fase === 'varrendo' && (
        <>
          <div className="barra"><span style={{ width: `${prog.total ? Math.min(100, (prog.feitas / prog.total) * 100) : 2}%` }} /></div>
          <div className="mudo">{prog.etapa}</div>
          <div className="grade g3">
            <div className="stat"><span className="rotulo">Páginas</span><span className="valor num" style={{ fontSize: '1.3rem' }}>{prog.feitas}/{prog.total}</span></div>
            <div className="stat"><span className="rotulo">Comunicações</span><span className="valor num" style={{ fontSize: '1.3rem' }}>{prog.comunicacoes}</span></div>
            <div className="stat"><span className="rotulo">Processos</span><span className="valor num" style={{ fontSize: '1.3rem' }}>{prog.processos}</span></div>
          </div>
          <p className="mudo" style={{ margin: 0 }}>Tempo restante estimado: ~{Math.max(1, minutos)} min. Não feche esta aba.</p>
          {avisos.map((a) => <div key={a} className="aviso">{a}</div>)}
          <div className="modal-acoes">
            <button className="btn" onClick={() => { parar.current = true; }}>Parar e revisar o que já encontrou</button>
          </div>
        </>
      )}

      {fase === 'revisar' && resultado && (
        <>
          <div className="grade g3">
            <div className="stat"><span className="rotulo">Processos novos</span><span className="valor num" style={{ fontSize: '1.4rem' }}>{resultado.processos.length}</span></div>
            <div className="stat"><span className="rotulo">Clientes novos</span><span className="valor num" style={{ fontSize: '1.4rem' }}>{resultado.clientesNovos.length}</span></div>
            <div className="stat"><span className="rotulo">Já cadastrados</span><span className="valor num" style={{ fontSize: '1.4rem' }}>{resultado.jaExistentes}</span></div>
          </div>
          {avisos.map((a) => <div key={a} className="aviso">{a}</div>)}
          {resultado.semCliente.length > 0 && (
            <details>
              <summary className="mudo">{resultado.semCliente.length} processo(s) em que o DJEN não informa a parte</summary>
              <label className="check" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={incluirSemCliente} onChange={(e) => { setIncluirSemCliente(e.target.checked); revisar(e.target.checked); }} />
                Importar mesmo assim, ligados a “{CLIENTE_A_IDENTIFICAR}” (para completar depois)
              </label>
              <ul className="lista">{resultado.semCliente.slice(0, 50).map((e) => <li key={e.digitos}><span className="mono">{e.numero}</span><span className="mudo">{e.tribunal}</span></li>)}</ul>
            </details>
          )}
          <div className="tabela-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Número</th><th>Cliente</th><th>Tipo</th><th>Assunto</th></tr></thead>
              <tbody>
                {resultado.processos.slice(0, 100).map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.numero}</td>
                    <td>{resultado.clientesNovos.find((c) => c.id === p.clienteId)?.nome || b.clientes.find((c) => c.id === p.clienteId)?.nome}</td>
                    <td>{ROTULO_TIPO[p.tipo]}</td>
                    <td className="mudo">{p.assunto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultado.processos.length > 100 && <p className="mudo" style={{ margin: 0 }}>Mostrando 100 de {resultado.processos.length}.</p>}
          <p className="mudo" style={{ margin: 0 }}>
            A importação fica registrada na aba Importações em seu nome. Os nomes vêm como estão no DJEN; clientes com o mesmo nome são tratados como a mesma pessoa. CPF e telefone ficam em branco.
          </p>
          <div className="modal-acoes">
            <button className="btn" onClick={aoFechar}>Cancelar</button>
            <button className="btn primario" onClick={importar} disabled={!resultado.processos.length}>Importar {resultado.processos.length} processos</button>
          </div>
        </>
      )}

      {fase === 'feito' && (
        <>
          <p>{importados} processos importados. O salvamento no banco continua por alguns segundos; acompanhe “Tudo salvo” no rodapé do menu.</p>
          <div className="modal-acoes"><button className="btn primario" onClick={aoFechar}>Fechar</button></div>
        </>
      )}
    </Modal>
  );
}
