import { inflateRawSync } from 'node:zlib';
import { gerarXlsx } from './xlsx';

/** Lê o ZIP pelo diretório central, como o Excel faz. */
function lerZip(z: Uint8Array): Map<string, string> {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  let fim = z.length - 22;
  while (v.getUint32(fim, true) !== 0x06054b50) fim--;
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const saida = new Map<string, string>();
  for (let i = 0; i < total; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const metodo = v.getUint16(p + 10, true);
    const tam = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nome = dec.decode(z.subarray(p + 46, p + 46 + nLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = z.subarray(ini, ini + tam);
    saida.set(nome, dec.decode(metodo === 8 ? inflateRawSync(dados) : dados));
    p += 46 + nLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return saida;
}

describe('xlsx', () => {
  it('gera um pacote válido com abas, texto escapado, números e moeda', () => {
    const z = gerarXlsx([
      { nome: 'Processos', linhas: [['Número', 'Cliente', 'Valor'], ['1055676-74.2026.4.01.3900', 'Maria & "Filha" <ç>', 6484.5], ['2', 'Joana', null]], colunasMoeda: [2] },
      { nome: 'Outra/aba?', linhas: [['a'], [1]] },
    ]);
    const f = lerZip(z);
    expect([...f.keys()]).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']));
    const s1 = f.get('xl/worksheets/sheet1.xml')!;
    expect(s1).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Maria &amp; &quot;Filha&quot; &lt;ç&gt;</t></is></c>');
    expect(s1).toContain('<c r="C2" s="2"><v>6484.5</v></c>');
    expect(s1).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(s1).toContain('<autoFilter ref="A1:C3"/>');
    expect(s1).not.toContain('r="C3"'); // célula vazia não é gravada
    expect(f.get('xl/workbook.xml')).toContain('name="Outra aba "');
  });
});
