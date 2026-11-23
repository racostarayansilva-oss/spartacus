import { lerCsv, linhasLegis, nomesDoCliente, planejarLegis, processoDaLinha, responsaveisDoArquivo, sugerirUsuario } from './importarLegis';
import { derivarNotificacoes } from './notificacoes';
import { ETIQUETAS_TAREFA } from './dadosIniciais';
import type { Banco, Usuario } from '../store';

const CSV = `﻿Título,Status,Prioridade,Complexidade,Tipo,Processo,Prazo,Responsáveis,Criado em,Conclusão
AVALIAR VIABILIDADE DE RECURSO - MARIA   SELMA ALVES MONTEIRO,Pendente,Média,Média,Atividade,MARIA SELMA ALVES MONTEIRO x INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS,01/12/2026,"Waleska Reis de Oliveira, WINNIE MARIA SILVA DE JESUS",18/11/2026,—
TAMIRES FERREIRA COSTA - 1003999-91.2024.4.01.3700 - Sentença Tipo C,Concluída,Alta,Média,Atividade,TAMIRES FERREIRA COSTA x INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS,18/11/2026,"WINNIE MARIA SILVA DE JESUS, Waleska Reis de Oliveira",18/11/2026,18/11/2026
"Solicita informações para a realização da pericia in loco, Telefone, endereço completo e ponto de referência - 13/11 - VALDINEIDE LIMA PESTANA",Concluída,Média,Média,Atividade,—,13/11/2026,"Waleska Reis de Oliveira, PEDRO BARBOSA",11/11/2026,18/11/2026
Verificação de cumprimento da tarefa dentro do prazo - 27/11,Pendente,Média,Média,Atividade,—,27/11/2026,Waleska Reis de Oliveira,05/11/2026,—
Verificação de cumprimento da tarefa dentro do prazo - 27/11,Pendente,Média,Média,Atividade,—,27/11/2026,Waleska Reis de Oliveira,05/11/2026,—
SENTENÇA TIPO C - ANALISAR VIABILIDADE DE RECURSO (PRAZO 28/10) ESTHEFANY SOUZA DE JESUS,Em andamento,Média,Média,Prazo,—,16/10/2026,"Helenilza Sousa Araujo, racostayasminasc, melque azevedo",16/10/2026,—
`;

const usuarios: Usuario[] = [
  { id: 'u-wal', nome: 'Waleska Reis de Oliveira', papel: 'equipe' },
  { id: 'u-pedro', nome: 'Pedro Barbosa', papel: 'equipe' },
  { id: 'u-yas', nome: 'Yasmin', papel: 'equipe' },
  { id: 'u-mel', nome: 'Melque', papel: 'equipe' },
  { id: 'u-rom', nome: 'Dr. Rômulo Alves Costa', papel: 'advogado' },
  { id: 'c1', nome: 'Winnie Cliente', papel: 'cliente' },
];

const banco = () => ({
  processos: [
    { id: 'p-tam', numero: '1003999-91.2024.4.01.3700', clienteId: 'x', etapas: [] },
    { id: 'p-selma', numero: '1', clienteId: 'c-selma', etapas: [{ etapa: 'Entrada', data: '2026-01-01' }] },
    { id: 'p-est', numero: '2', clienteId: 'c-est', etapas: [] },
  ],
  clientes: [{ id: 'c-selma', nome: 'Maria Selma Alves Monteiro' }, { id: 'c-est', nome: 'Esthefany Souza de Jesus' }],
  tarefas: [],
  config: { etiquetasTarefa: ETIQUETAS_TAREFA },
}) as unknown as Banco;

describe('importação do Legis', () => {
  it('lê o CSV com aspas, vírgulas no título e datas', () => {
    expect(lerCsv('a,"b, c",d\n"e ""x""",f,g\n')).toEqual([['a', 'b, c', 'd'], ['e "x"', 'f', 'g']]);
    const l = linhasLegis(CSV);
    expect(l).toHaveLength(6);
    expect(l[0]).toMatchObject({ titulo: 'AVALIAR VIABILIDADE DE RECURSO - MARIA SELMA ALVES MONTEIRO', prazo: '2026-12-01', criadoEm: '2026-11-18', conclusao: undefined });
    expect(l[0].responsaveis).toEqual(['Waleska Reis de Oliveira', 'WINNIE MARIA SILVA DE JESUS']);
    expect(l[2].titulo.startsWith('Solicita informações para a realização da pericia in loco, Telefone')).toBe(true);
    expect(l[2].processo).toBe('');
    expect(responsaveisDoArquivo(l)[0]).toEqual({ nome: 'Waleska Reis de Oliveira', tarefas: 5 });
  });

  it('sugere a pessoa pelo nome completo, primeiro nome ou login', () => {
    expect(sugerirUsuario('Waleska Reis de Oliveira', usuarios)).toBe('u-wal');
    expect(sugerirUsuario('PEDRO BARBOSA', usuarios)).toBe('u-pedro');
    expect(sugerirUsuario('racostayasminasc', usuarios)).toBe('u-yas');
    expect(sugerirUsuario('melque azevedo', usuarios)).toBe('u-mel');
    expect(sugerirUsuario('racosta20251009', usuarios)).toBeUndefined();
    expect(sugerirUsuario('WINNIE MARIA SILVA DE JESUS', usuarios)).toBeUndefined(); // cliente não conta
  });

  it('acha o processo pelo número CNJ ou pelo nome do cliente', () => {
    const [selma, tamires, valdineide, , , esthefany] = linhasLegis(CSV);
    expect(processoDaLinha(tamires, banco())).toBe('p-tam');
    expect(processoDaLinha(selma, banco())).toBe('p-selma');
    expect(processoDaLinha(esthefany, banco())).toBe('p-est');
    expect(processoDaLinha(valdineide, banco())).toBeUndefined();
    expect(nomesDoCliente(valdineide)).toEqual(['VALDINEIDE LIMA PESTANA']);
  });

  it('monta as tarefas; reimportar atualiza sem duplicar e sem notificar ninguém', () => {
    const b = banco();
    const mapa = { 'Waleska Reis de Oliveira': 'u-wal', 'PEDRO BARBOSA': 'u-pedro', racostayasminasc: 'u-yas', 'melque azevedo': 'u-mel' };
    const p1 = planejarLegis(linhasLegis(CSV), b, mapa, '2026-11-19T10:00:00Z');
    expect(p1).toMatchObject({ novas: 6, atualizadas: 0, comProcesso: 3 });
    const ids = p1.tarefas.map((t) => t.id);
    expect(new Set(ids).size).toBe(6); // as duas "Verificação…" iguais viram tarefas distintas
    const tam = p1.tarefas[1];
    expect(tam).toMatchObject({ coluna: 'concluido', concluidaEm: '2026-11-18', responsavelId: 'u-wal', participantes: [], etiquetas: ['ett-urgente'], origem: 'legis' });
    const est = p1.tarefas[5];
    expect(est).toMatchObject({ coluna: 'fazendo', responsavelId: 'u-yas', participantes: ['u-mel'], etiquetas: ['ett-prazo'], prazo: '2026-10-16' });
    expect(est.descricao).toContain('Responsáveis no Legis: Helenilza Sousa Araujo, racostayasminasc, melque azevedo.');

    expect(derivarNotificacoes([], p1.tarefas, usuarios, 'u-rom', '2026-11-19T10:00:00Z', () => 'n')).toHaveLength(0);

    b.tarefas = p1.tarefas.map((t) => (t.id === tam.id ? { ...t, comentarios: [{ id: 'k', em: '', usuarioId: 'u-wal', texto: 'ok' }] } : t));
    const p2 = planejarLegis(linhasLegis(CSV), b, mapa, '2026-11-20T10:00:00Z', false);
    expect(p2).toMatchObject({ novas: 0, atualizadas: 4 }); // concluídas fora
    expect(planejarLegis(linhasLegis(CSV), b, mapa, '2026-11-20T10:00:00Z').tarefas[1].comentarios).toHaveLength(1);
  });
});
