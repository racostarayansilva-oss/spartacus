import { describe, expect, it } from 'vitest';
import {
  alternarPasso, duracao, enderecoEscritorio, limparDominioProprio, MINUTOS_PREVISTOS, minutosDecorridos, PASSOS_IMPLANTACAO,
  progresso, slugDoNome, slugValido,
} from './implantacao';
import { contraste, legivelSobre, tokensDaMarca, hostDoEscritorio } from '../marca';

describe('roteiro de implantação', () => {
  it('cabe em 3 horas', () => {
    expect(MINUTOS_PREVISTOS).toBeLessThanOrEqual(180);
  });
  it('marca, desmarca e calcula o progresso pelo tempo de cada passo', () => {
    let e = alternarPasso(undefined, 'cadastro', 'u1', '2026-11-23T10:00:00Z');
    expect(e.inicio).toBe('2026-11-23T10:00:00Z');
    e = alternarPasso(e, 'processos', 'u1', '2026-11-23T11:00:00Z');
    const p = progresso(e);
    expect(p.feitos).toBe(2);
    expect(p.percentual).toBe(Math.round((60 / MINUTOS_PREVISTOS) * 100));
    expect(p.proximo?.id).toBe('marca');
    e = alternarPasso(e, 'processos', 'u1', '2026-11-23T11:05:00Z');
    expect(progresso(e).feitos).toBe(1);
  });
  it('tempo decorrido para no último passo quando termina', () => {
    let e: any = { inicio: '2026-11-23T10:00:00Z' };
    PASSOS_IMPLANTACAO.forEach((p, i) => { e = alternarPasso(e, p.id, 'u', `2026-11-23T1${Math.min(i, 9)}:00:00Z`.replace('T19', 'T12')); });
    expect(progresso(e).concluida).toBe(true);
    expect(minutosDecorridos(e, '2026-11-30T00:00:00Z')).toBeLessThan(24 * 60);
    expect(minutosDecorridos({}, '2026-11-23T10:00:00Z')).toBeNull();
    expect(duracao(135)).toBe('2h15');
    expect(duracao(40)).toBe('40 min');
  });
});

describe('endereço do escritório', () => {
  it('gera o subdomínio a partir do nome', () => {
    expect(slugDoNome('Silva & Souza Advocacia')).toBe('silva-souza');
    expect(slugDoNome('Escritório Conceição Advogados Associados')).toBe('conceicao');
    expect(slugValido('silva-souza')).toBe(true);
    expect(slugValido('www')).toBe(false);
    expect(slugValido('-x')).toBe(false);
  });
  it('domínio próprio limpo', () => {
    expect(limparDominioProprio('https://Sistema.SilvaAdv.com.br/')).toBe('sistema.silvaadv.com.br');
    expect(limparDominioProprio('não é domínio')).toBeNull();
  });
  it('endereço: domínio próprio > subdomínio > parâmetro', () => {
    expect(enderecoEscritorio('silva', 'spartacus.adv.br', ['sistema.silva.com.br'])).toBe('https://sistema.silva.com.br');
    expect(enderecoEscritorio('silva', 'spartacus.adv.br')).toBe('https://silva.spartacus.adv.br');
    expect(enderecoEscritorio('silva', '', [], 'http://localhost:5173')).toBe('http://localhost:5173/?escritorio=silva');
  });
  it('qual escritório o endereço indica', () => {
    const base = 'spartacus.adv.br';
    expect(hostDoEscritorio({ hostname: 'silva.spartacus.adv.br', search: '' }, base)).toBe('silva.spartacus.adv.br');
    expect(hostDoEscritorio({ hostname: 'app.spartacus.adv.br', search: '' }, base)).toBeNull();
    expect(hostDoEscritorio({ hostname: 'spartacus.adv.br', search: '' }, base)).toBeNull();
    expect(hostDoEscritorio({ hostname: 'localhost', search: '' }, base)).toBeNull();
    expect(hostDoEscritorio({ hostname: 'sistema.silva.com.br', search: '' }, base)).toBe('sistema.silva.com.br');
  });
});

describe('cores da marca', () => {
  it('Spartacus: azul legível no claro, clareado no escuro, destaque verde-limão com texto escuro', () => {
    const t = tokensDaMarca({ corPrimaria: '#0131CD', corDestaque: '#B9FC01' });
    expect(t.claro['--primario']).toBe('#0131cd');
    expect(t.claro['--sobre-primario']).toBe('#ffffff');
    expect(contraste(t.escuro['--primario'], '#1e2329')).toBeGreaterThanOrEqual(4.5);
    expect(t.comum['--sobre-destaque']).toBe('#0b0e11');
    expect(contraste(t.comum['--lateral-ativo'], t.comum['--lateral'])).toBeGreaterThanOrEqual(4.5);
  });
  it('cor clara demais é escurecida para texto em fundo branco', () => {
    const c = legivelSobre('#FFE066', '#ffffff');
    expect(contraste(c, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('cor inválida usa a padrão', () => {
    expect(tokensDaMarca({ corPrimaria: 'azul' }).claro['--primario']).toBe('#0131cd');
  });
});
