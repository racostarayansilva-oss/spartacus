// Decisões por CPF: processos em que a pessoa é parte, em qualquer tribunal.
// Regras: cliente vê só o próprio CPF; advogado vê os CPFs dos clientes dele (LGPD, art. 7º, V e VI);
// toda consulta é registrada; processos em segredo de justiça ficam de fora.
import { useState } from 'react';
import { alterar, Banco, MODO_NUVEM, nomeUsuario, useBanco, usuarioAtual } from '../store';
import { recarregarLogsCpf } from '../nuvem';
import { cpfValido, formatarCpf, mascararCpf, somenteDigitos } from '../lib/cpf';
import { formatar } from '../lib/datas';
import { api } from '../api';
import { Campo, Topo, Vazio } from '../components/ui';

/** Diz se o usuário logado pode consultar este CPF, e por quê. */
export function podeConsultar(b: Banco, cpf: string): { ok: boolean; motivo: string } {
  const u = usuarioAtual(b);
  const c = somenteDigitos(cpf);
  if (u.papel === 'cliente') {
    return somenteDigitos(u.cpf || '') === c ? { ok: true, motivo: 'próprio CPF' } : { ok: false, motivo: 'Cliente só pode consultar o próprio CPF.' };
  }
  const cliente = b.clientes.find((x) => x.cpf === c);
  if (!cliente) return { ok: false, motivo: 'Este CPF não é de um cliente cadastrado no escritório.' };
  if (u.papel === 'advogado') return { ok: true, motivo: `cliente do escritório (${cliente.nome})` };
  if (cliente.responsavelId === u.id) return { ok: true, motivo: `cliente sob sua responsabilidade (${cliente.nome})` };
  return { ok: false, motivo: `Cliente sob responsabilidade de ${nomeUsuario(b, cliente.responsavelId)}.` };
}

export default function DecisoesCpf() {
  const b = useBanco();
  const u = usuarioAtual(b);
  const [cpf, setCpf] = useState(u.papel === 'cliente' ? u.cpf || '' : '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [res, setRes] = useState<any>(null);

  const valido = cpfValido(cpf);
  const acesso = valido ? podeConsultar(b, cpf) : null;

  const consultar = async () => {
    if (!valido || !acesso?.ok) return;
    setCarregando(true);
    setErro('');
    setRes(null);
    let resultado = 'erro';
    try {
      const r = await api('cpf', { method: 'POST', body: JSON.stringify({ cpf: somenteDigitos(cpf) }) });
      setRes(r);
      resultado = `${r.processos.length} processo(s)`;
    } catch (e: any) {
      setErro(e.message);
      resultado = 'erro: ' + e.message;
    } finally {
      setCarregando(false);
      if (MODO_NUVEM) {
        // Na nuvem o servidor grava a auditoria no banco; aqui só recarrega a lista
        recarregarLogsCpf().catch(() => undefined);
      } else {
        alterar((db) => { db.logsCpf.unshift({ em: new Date().toISOString(), usuarioId: u.id, cpfMascarado: mascararCpf(cpf), resultado }); db.logsCpf = db.logsCpf.slice(0, 200); });
      }
    }
  };

  return (
    <>
      <Topo titulo="Decisões por CPF" subtitulo="Processos e decisões em que a pessoa aparece como parte, em qualquer tribunal." />
      <div className="grade g2">
        <div className="cartao">
          <Campo rotulo="CPF">
            <input value={formatarCpf(cpf)} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" disabled={u.papel === 'cliente'} />
          </Campo>
          {cpf.length >= 11 && !valido && <div className="erro mt">CPF inválido (dígitos verificadores não conferem).</div>}
          {acesso && !acesso.ok && <div className="erro mt">{acesso.motivo}</div>}
          {acesso?.ok && <p className="mudo">Acesso liberado: {acesso.motivo}.</p>}
          <div className="flex mt"><button className="btn primario" disabled={!acesso?.ok || carregando} onClick={consultar}>{carregando ? 'Consultando…' : 'Consultar'}</button></div>
          <p className="mudo mt" style={{ marginBottom: 0 }}>
            Base legal: LGPD, art. 7º, V (execução de contrato) e VI (exercício regular de direitos em processo). Toda consulta fica registrada. Processos em segredo de justiça são removidos.
            O DataJud não busca por CPF; esta consulta usa um provedor contratado (Judit, Escavador, Vigilant ou Jusneural).
          </p>
        </div>
        <div className="cartao">
          <h3>Registro de consultas</h3>
          {b.logsCpf.length === 0 ? <Vazio>Nenhuma consulta ainda.</Vazio> : (
            <ul className="lista" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {b.logsCpf.map((l, i) => (
                <li key={i}><span><span className="mono">{l.cpfMascarado}</span><div className="mudo">{nomeUsuario(b, l.usuarioId)} · {l.resultado}</div></span><span className="num mudo">{formatar(l.em.slice(0, 10))} {l.em.slice(11, 16)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {erro && <div className="erro secao">{erro}</div>}
      {res && (
        <div className="cartao secao tabela-wrap">
          <div className="cartao-cab">
            <h3>{res.processos.length} processo(s) · via {res.provedor}</h3>
            {res.removidosPorSigilo > 0 && <span className="etiqueta">{res.removidosPorSigilo} em segredo de justiça omitido(s)</span>}
          </div>
          {res.processos.length === 0 ? <Vazio>Nenhum processo encontrado.</Vazio> : (
            <table>
              <thead><tr><th>Número</th><th>Tribunal</th><th>Classe / assunto</th><th>Última movimentação</th></tr></thead>
              <tbody>
                {res.processos.map((p: any) => (
                  <tr key={p.numero}>
                    <td className="mono">{p.numero}</td><td>{p.tribunal}</td>
                    <td>{p.classe}<div className="mudo">{p.assunto}</div></td>
                    <td>{p.ultimaMovimentacao?.slice(0, 200)}<div className="mudo num">{formatar(p.dataUltimaMovimentacao?.slice(0, 10))}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
