import { describe, expect, it } from 'vitest';
import type { Tarefa, Usuario } from '../store';
import { derivarNotificacoes, mencionados, partesComMencao } from './notificacoes';

const U: Usuario[] = [
  { id: 'r', nome: 'Dr. Rômulo Alves Costa', papel: 'advogado' },
  { id: 'a', nome: 'Ana (Controladoria)', papel: 'equipe' },
  { id: 'ap', nome: 'Ana Paula Lima', papel: 'equipe' },
  { id: 'b', nome: 'Bruno (Protocolo)', papel: 'equipe' },
  { id: 'c', nome: 'Cliente Maria', papel: 'cliente' },
];
const t = (x: Partial<Tarefa>): Tarefa => ({ id: 't', titulo: 'Réplica', responsavelId: 'r', pontos: 2, coluna: 'afazer', ...x });
let n = 0;
const id = () => `n${++n}`;

describe('menções', () => {
  it('acha pelo primeiro nome (sem acento) e pelo nome completo; nome repetido exige o completo', () => {
    expect(mencionados('@romulo e @Bruno, vejam', U)).toEqual(['r', 'b']);
    expect(mencionados('@Ana Paula Lima pode?', U)).toEqual(['ap']);
    expect(mencionados('@Ana (Controladoria) ok', U)).toEqual(['a']);
    expect(mencionados('@Ana sozinho é ambíguo', U)).toEqual([]);
    expect(mencionados('email fulano@bruno.com e @Brunoo', U)).toEqual([]);
    expect(mencionados('@Cliente não é equipe', U)).toEqual([]);
  });
  it('marca os trechos para destacar', () => {
    expect(partesComMencao('Oi @Rômulo!', U)).toEqual([{ texto: 'Oi ' }, { texto: '@Rômulo', usuarioId: 'r' }, { texto: '!' }]);
  });
});

describe('notificações das tarefas', () => {
  it('tarefa nova avisa responsável e participantes, menos quem criou', () => {
    const r = derivarNotificacoes([], [t({ responsavelId: 'a', participantes: ['b', 'r'] })], U, 'r', 'agora', id);
    expect(r.map((x) => [x.paraId, x.tipo, x.deId])).toEqual([['a', 'tarefa_criada', 'r'], ['b', 'tarefa_criada', 'r']]);
  });
  it('quem entra numa tarefa existente é avisado; quem já estava não', () => {
    const antes = [t({ participantes: ['b'] })];
    const r = derivarNotificacoes(antes, [t({ responsavelId: 'ap', participantes: ['b'] })], U, 'r', 'agora', id);
    expect(r.map((x) => [x.paraId, x.tipo])).toEqual([['ap', 'tarefa_atribuida']]);
  });
  it('comentário novo com menção avisa o mencionado, com o trecho', () => {
    const antes = [t({ comentarios: [{ id: 'c1', em: '', usuarioId: 'a', texto: '@Bruno antigo' }] })];
    const depois = [t({ comentarios: [...antes[0].comentarios!, { id: 'c2', em: '', usuarioId: 'b', texto: '@Rômulo revisa? @Bruno' }] })];
    const r = derivarNotificacoes(antes, depois, U, 'b', 'agora', id);
    expect(r.map((x) => [x.paraId, x.tipo, x.comentarioId, x.trecho])).toEqual([['r', 'mencao', 'c2', '@Rômulo revisa? @Bruno']]);
  });
  it('menção nova na descrição avisa só quem ainda não tinha sido mencionado', () => {
    const r = derivarNotificacoes([t({ descricao: 'falar com @Bruno' })], [t({ descricao: 'falar com @Bruno e @Ana Paula Lima' })], U, 'r', 'agora', id);
    expect(r.map((x) => x.paraId)).toEqual(['ap']);
  });
});
