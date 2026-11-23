import { MODELOS, preencher } from './modelos';

describe('Modelos de documentos', () => {
  const procuracao = MODELOS.find((m) => m.id === 'procuracao')!;
  const contrato = MODELOS.find((m) => m.id === 'procuracao-contrato')!;

  it('preenche nome, CPF formatado e endereço', () => {
    const html = preencher(procuracao, { nome: 'Maria Silva', cpf: '52998224725', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Luís', uf: 'MA', cep: '65000-000', estadoCivil: 'Casada', profissao: 'Diarista', telefone: '(98) 99999-0000', rg: '123' });
    expect(html).toContain('Maria Silva');
    expect(html).toContain('529.982.247-25');
    expect(html).toContain('São Luís');
  });

  it('o que fica em branco vira lacuna', () => {
    const html = preencher(procuracao, { nome: 'Maria' });
    expect(html).toContain('<span class="lacuna">');
  });

  it('o contrato aceita o campo honorários', () => {
    const html = preencher(contrato, { nome: 'João', honorarios: '30% sobre a condenação' });
    expect(html).toContain('30% sobre a condenação');
  });

  it('escapa HTML vindo dos dados do cliente', () => {
    const html = preencher(procuracao, { nome: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('tem os quatro modelos pedidos', () => {
    expect(MODELOS.map((m) => m.id)).toEqual(['hipossuficiencia', 'endereco', 'procuracao', 'procuracao-contrato']);
  });
});
