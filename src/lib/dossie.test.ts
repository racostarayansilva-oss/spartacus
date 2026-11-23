import type { Banco, Cliente } from '../store';
import { analiseIdade, documentosPadrao, dossieHtml, dossieTexto, pendentes, tempoAte } from './dossie';

const banco = { corretores: [{ id: 'k1', nome: 'P. Lucas', telefone: '', regioes: [] }] } as unknown as Banco;
const cliente: Cliente = {
  id: 'c1', nome: 'Albertino Silva Conceição', cpf: '52998224725', telefone: '', origem: 'corretor', corretorId: 'k1', criadoEm: '2026-04-15',
  nascimento: '1967-05-30', sexo: 'M', beneficio: 'aposentadoria_rural', cidade: 'Ipixuna', uf: 'PA',
  documentos: [
    { id: 'd1', nome: 'CNIS atualizado', entregue: false },
    { id: 'd2', nome: 'RG e CPF', entregue: true },
  ],
  anotacoes: [{ id: 'a1', data: '2026-04-20', usuarioId: 'u', texto: 'Cliente vai trazer a CTPS.' }],
};

describe('Dossiê do cliente', () => {
  it('aposentadoria rural de homem com 58 anos: ainda não tem idade e diz quando completa', () => {
    const a = analiseIdade(cliente, '2026-04-15')!;
    expect(a.situacao).toBe('falta');
    expect(a.idade).toBe(58);
    expect(a.completaEm).toBe('2027-05-30');
    expect(a.texto).toContain('Possui somente 58 anos');
    expect(a.texto).toContain('faltam 1 ano e 1 mês');
  });

  it('idade atingida, sem sexo e benefício sem idade mínima', () => {
    expect(analiseIdade({ ...cliente, sexo: 'F' }, '2026-04-15')!.situacao).toBe('atingiu'); // mulher rural: 55
    expect(analiseIdade({ ...cliente, sexo: undefined }, '2026-04-15')!.situacao).toBe('sem-sexo');
    expect(analiseIdade({ ...cliente, beneficio: 'maternidade' }, '2026-04-15')!.situacao).toBe('sem-requisito');
    expect(analiseIdade({ ...cliente, nascimento: undefined }, '2026-04-15')).toBeNull();
  });

  it('tempo até uma data', () => {
    expect(tempoAte('2026-04-15', '2026-05-01')).toBe('16 dias');
    expect(tempoAte('2026-01-31', '2026-04-30')).toBe('3 meses'); // fim de mês conta como mês cheio
    expect(tempoAte('2026-01-31', '2026-04-29')).toBe('2 meses');
    expect(tempoAte('2025-03-10', '2027-03-10')).toBe('2 anos');
  });

  it('lista padrão de documentos por benefício', () => {
    let n = 0;
    const docs = documentosPadrao('aposentadoria_rural', () => `x${++n}`);
    expect(docs.map((d) => d.nome)).toContain('Documentos que comprovem atividade rural');
    expect(docs.every((d) => !d.entregue)).toBe(true);
    expect(documentosPadrao(undefined, () => 'x')).toEqual([]);
    expect(pendentes(cliente).map((d) => d.nome)).toEqual(['CNIS atualizado']);
  });

  it('texto no formato do dossiê manual', () => {
    const t = dossieTexto(banco, cliente, '2026-04-15');
    expect(t.split('\n').slice(0, 6)).toEqual([
      'NOME: ALBERTINO SILVA CONCEIÇÃO',
      'CPF: 529.982.247-25',
      'APOSENTADORIA POR IDADE RURAL',
      'CIDADE: IPIXUNA - PA',
      'CORRETOR: P. LUCAS',
      'DATA DE NASCIMENTO: 30/05/1967',
    ]);
    expect(t).toContain('(15/04/2026) OBS: POSSUI SOMENTE 58 ANOS');
    expect(t).toContain('(20/04/2026) OBS: Cliente vai trazer a CTPS.');
    expect(t).toContain('DOCUMENTOS QUE ESTÃO FALTANDO:\nCNIS atualizado;');
    expect(t).not.toContain('RG e CPF;');
  });

  it('HTML do dossiê escapa o que vem do cadastro', () => {
    const html = dossieHtml(banco, { ...cliente, nome: '<script>x</script>' }, '2026-04-15');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('FALTANDO');
  });
});
