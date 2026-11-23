import type { Banco } from '../store';
import { editarEtapa, excluirProcesso, montarAssunto, partesDoAssunto, registrarEtapa, removerEtapa, vinculosDoProcesso } from './processos';
import { vidaDoProcesso } from './etapas';

let seq = 0;
const id = () => `id${++seq}`;

const banco = (): Banco =>
  ({
    processos: [
      { id: 'p1', numero: '1', etapas: [{ etapa: 'Entrada', data: '2026-01-10' }], grupoFamiliar: [] },
      { id: 'p2', numero: '2', etapas: [], grupoFamiliar: [] },
    ],
    audiencias: [{ id: 'a1', processoId: 'p1' }, { id: 'a2', processoId: 'p2' }],
    compromissos: [{ id: 'm1', processoId: 'p1' }],
    tarefas: [{ id: 't1', processoId: 'p1' }],
    registros: [{ id: 'r1', processoId: 'p1', tipo: 'despacho', data: '2026-02-01' }],
    lancamentos: [{ id: 'f1', processoId: 'p1' }],
  }) as unknown as Banco;

describe('assunto do processo', () => {
  it('separa e monta "Classe — contra Parte"', () => {
    expect(partesDoAssunto('Procedimento JEF — contra INSS')).toEqual({ classe: 'Procedimento JEF', contra: 'INSS' });
    expect(partesDoAssunto('Só classe')).toEqual({ classe: 'Só classe', contra: '' });
    expect(montarAssunto(' Procedimento JEF ', ' INSS ')).toBe('Procedimento JEF — contra INSS');
    expect(montarAssunto('BPC', '')).toBe('BPC');
    expect(partesDoAssunto(montarAssunto('A — B', 'C'))).toEqual({ classe: 'A — B', contra: 'C' });
  });
});

describe('excluir processo', () => {
  it('apaga as audiências e desliga o resto sem apagar', () => {
    const db = banco();
    expect(vinculosDoProcesso(db, 'p1')).toEqual({ audiencias: 1, compromissos: 1, tarefas: 1, registros: 1, lancamentos: 1 });
    excluirProcesso(db, 'p1');
    expect(db.processos.map((p) => p.id)).toEqual(['p2']);
    expect(db.audiencias.map((a) => a.id)).toEqual(['a2']);
    expect(db.compromissos[0].processoId).toBeNull();
    expect(db.tarefas[0].processoId).toBeNull();
    expect(db.registros[0].processoId).toBeNull();
    expect(db.lancamentos[0].processoId).toBeNull();
  });
});

describe('etapas', () => {
  it('registrar sentença cria a produção no Painel; remover tira as duas', () => {
    const db = banco();
    registrarEtapa(db, 'p1', { etapa: 'Sentença', data: '2026-05-01', resultado: 'procedente' }, 'u1', id);
    expect(db.registros.filter((r) => r.tipo === 'sentenca')).toHaveLength(1);
    expect(db.registros.find((r) => r.tipo === 'sentenca')?.resultado).toBe('procedente');

    const linha = vidaDoProcesso(db.processos[0].etapas).find((e) => e.etapa === 'Sentença')!;
    removerEtapa(db, 'p1', linha.indice);
    expect(db.processos[0].etapas.map((e) => e.etapa)).toEqual(['Entrada']);
    expect(db.registros.filter((r) => r.tipo === 'sentenca')).toHaveLength(0);
    expect(db.registros).toHaveLength(1); // o despacho continua
  });

  it('editar mantém o Painel coerente e preserva quem lançou', () => {
    const db = banco();
    registrarEtapa(db, 'p1', { etapa: 'Sentença', data: '2026-05-01', resultado: 'procedente' }, 'u-autor', id);
    editarEtapa(db, 'p1', 1, { etapa: 'Sentença', data: '2026-05-03', resultado: 'improcedente', obs: '  ' }, 'u-outro', id);
    const s = db.registros.filter((r) => r.tipo === 'sentenca');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ data: '2026-05-03', resultado: 'improcedente', usuarioId: 'u-autor' });
    expect(db.processos[0].etapas[1]).toEqual({ etapa: 'Sentença', data: '2026-05-03', resultado: 'improcedente', obs: undefined });

    // Trocar para uma etapa que não conta no Painel remove a produção
    editarEtapa(db, 'p1', 1, { etapa: 'Documentação', data: '2026-05-03', resultado: 'procedente' }, 'u-outro', id);
    expect(db.registros.filter((r) => r.tipo === 'sentenca')).toHaveLength(0);
    expect(db.processos[0].etapas[1].resultado).toBeUndefined();
  });

  it('vida do processo guarda a posição original de cada etapa', () => {
    const vida = vidaDoProcesso([
      { etapa: 'B', data: '2026-03-01' },
      { etapa: 'A', data: '2026-01-01' },
    ]);
    expect(vida.map((e) => [e.etapa, e.indice])).toEqual([['A', 1], ['B', 0]]);
  });
});
