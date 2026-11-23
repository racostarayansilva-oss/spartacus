import { Banco, nomeUsuario } from '../../store';
import { DataISO, hoje, parse, somarDias } from '../../lib/datas';
import { iniciais } from '../TarefaUI';
import { Icone } from '../icones';

export function dataLonga(d: DataISO): string {
  return parse(d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function horaDe(isoDataHora: string): string {
  const d = new Date(isoDataHora);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function NavegadorData({ data, aoMudar }: { data: DataISO; aoMudar: (d: DataISO) => void }) {
  const h = hoje();
  return (
    <div className="nav-data">
      <button className="btn fantasma pequeno" onClick={() => aoMudar(somarDias(data, -1))} aria-label="Dia anterior"><Icone nome="seta-esq" tamanho={16} /></button>
      <span className="nav-data-rotulo">{data === h ? 'Hoje, ' : ''}{dataLonga(data)}</span>
      <button className="btn fantasma pequeno" onClick={() => aoMudar(somarDias(data, 1))} disabled={data >= h} aria-label="Próximo dia"><Icone nome="seta-dir" tamanho={16} /></button>
      {data !== h && <button className="btn pequeno" onClick={() => aoMudar(h)}>Hoje</button>}
    </div>
  );
}

/** Iniciais em tom neutro: nos relatórios a cor fica reservada para os dados e o status. */
export function Avatar({ b, id, tamanho = 32 }: { b: Banco; id: string; tamanho?: number }) {
  return (
    <span className="avatar-neutro" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }} aria-hidden="true">
      {iniciais(nomeUsuario(b, id))}
    </span>
  );
}

export const porcentagem = (v: number) => `${Math.round(v * 100)}%`;

export const entregas = (n: number) => `${n} ${n === 1 ? 'entrega' : 'entregas'}`;

export const equipeDe =(b: Banco) => b.usuarios.filter((u) => u.papel === 'advogado' || u.papel === 'equipe');
