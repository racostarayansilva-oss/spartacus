// Ferramentas de PDF que rodam no navegador: os arquivos dos clientes não saem do computador.
import type { PDFDocument as Doc } from 'pdf-lib';

export type Saida = { nome: string; bytes: Uint8Array };

const A4: [number, number] = [595.28, 841.89];

const pdfLib = () => import('pdf-lib');

export function ehPdf(f: File) {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}
export function ehImagem(f: File) {
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
}

export function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1).replace('.', ',')} MB`;
}

export function semExtensao(nome: string) {
  return nome.replace(/\.[^.]+$/, '');
}

async function abrir(f: File): Promise<Doc> {
  const { PDFDocument } = await pdfLib();
  try {
    return await PDFDocument.load(await f.arrayBuffer());
  } catch (e) {
    if (String(e).includes('encrypted')) throw new Error(`"${f.name}" está protegido por senha. Remova a senha antes de usar este arquivo.`);
    throw new Error(`Não foi possível ler "${f.name}". Confira se o arquivo é um PDF válido.`);
  }
}

// JPG e PNG entram direto; outros formatos (WebP, GIF, BMP) passam por um canvas e viram JPG.
async function bytesDaImagem(f: File): Promise<{ tipo: 'jpg' | 'png'; bytes: ArrayBuffer }> {
  if (/jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name)) return { tipo: 'jpg', bytes: await f.arrayBuffer() };
  if (f.type === 'image/png' || /\.png$/i.test(f.name)) return { tipo: 'png', bytes: await f.arrayBuffer() };
  const bmp = await createImageBitmap(f).catch(() => { throw new Error(`O formato de "${f.name}" não é suportado. Use JPG, PNG ou WebP.`); });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.92));
  return { tipo: 'jpg', bytes: await blob.arrayBuffer() };
}

export type OpcoesImagem = { pagina: 'a4' | 'imagem'; margem: number };

async function adicionarImagem(doc: Doc, f: File, o: OpcoesImagem) {
  const { tipo, bytes } = await bytesDaImagem(f);
  const img = tipo === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  if (o.pagina === 'imagem') {
    doc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    return;
  }
  // A4 na orientação que melhor acomoda a imagem, centralizada dentro da margem
  const [w, h] = img.width > img.height ? [A4[1], A4[0]] : A4;
  const m = o.margem;
  const escala = Math.min((w - 2 * m) / img.width, (h - 2 * m) / img.height, 1.5);
  const iw = img.width * escala, ih = img.height * escala;
  doc.addPage([w, h]).drawImage(img, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
}

export async function imagensParaPdf(arquivos: File[], o: OpcoesImagem): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib();
  const doc = await PDFDocument.create();
  for (const f of arquivos) await adicionarImagem(doc, f, o);
  return doc.save();
}

// Junta PDFs e imagens na ordem recebida.
export async function juntar(arquivos: File[], aoProgredir?: (i: number) => void): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib();
  const doc = await PDFDocument.create();
  for (const [i, f] of arquivos.entries()) {
    aoProgredir?.(i);
    if (ehPdf(f)) {
      const origem = await abrir(f);
      for (const p of await doc.copyPages(origem, origem.getPageIndices())) doc.addPage(p);
    } else {
      await adicionarImagem(doc, f, { pagina: 'a4', margem: 0 });
    }
  }
  return doc.save();
}

export async function contarPaginas(f: File) {
  return (await abrir(f)).getPageCount();
}

// "1-3, 5, 8-" → [[0,1,2],[4],[7..fim]]. Páginas fora do documento geram erro com a explicação.
export function lerIntervalos(texto: string, total: number): number[][] {
  const partes = texto.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!partes.length) throw new Error('Informe as páginas. Ex.: 1-3, 4-10, 11');
  return partes.map((p) => {
    const m = p.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`Não entendi "${p}". Use números e traços, como 1-3 ou 5.`);
    const ini = m[1] ? Number(m[1]) : 1;
    const fim = m[2] ? (m[3] ? Number(m[3]) : total) : ini;
    if (ini < 1 || fim > total || ini > fim) throw new Error(`O intervalo "${p}" não existe: o documento tem ${total} página${total > 1 ? 's' : ''}.`);
    return Array.from({ length: fim - ini + 1 }, (_, i) => ini - 1 + i);
  });
}

export function gruposDe(total: number, porArquivo: number): number[][] {
  const n = Math.max(1, Math.floor(porArquivo));
  return Array.from({ length: Math.ceil(total / n) }, (_, g) => Array.from({ length: Math.min(n, total - g * n) }, (_, i) => g * n + i));
}

async function extrair(origem: Doc, paginas: number[]) {
  const { PDFDocument } = await pdfLib();
  const doc = await PDFDocument.create();
  for (const p of await doc.copyPages(origem, paginas)) doc.addPage(p);
  return doc.save();
}

function nomeParte(base: string, paginas: number[]) {
  const a = paginas[0] + 1, b = paginas[paginas.length - 1] + 1;
  return `${base} - pág ${a === b ? a : `${a}-${b}`}.pdf`;
}

export type ModoDivisao = { tipo: 'intervalos'; texto: string } | { tipo: 'paginas'; n: number } | { tipo: 'tamanho'; mb: number };

export async function dividir(f: File, modo: ModoDivisao, aoProgredir?: (feito: number, total: number) => void): Promise<Saida[]> {
  const origem = await abrir(f);
  const total = origem.getPageCount();
  const base = semExtensao(f.name);

  if (modo.tipo !== 'tamanho') {
    const grupos = modo.tipo === 'intervalos' ? lerIntervalos(modo.texto, total) : gruposDe(total, modo.n);
    const saida: Saida[] = [];
    for (const [i, g] of grupos.entries()) {
      aoProgredir?.(i, grupos.length);
      saida.push({ nome: nomeParte(base, g), bytes: await extrair(origem, g) });
    }
    return saida;
  }

  // Por tamanho: vai acumulando páginas enquanto o arquivo couber no limite.
  const limite = modo.mb * 1024 * 1024;
  const saida: Saida[] = [];
  let atual: number[] = [];
  let bytesAtual: Uint8Array | null = null;
  for (let p = 0; p < total; p++) {
    aoProgredir?.(p, total);
    const teste = await extrair(origem, [...atual, p]);
    if (teste.length <= limite || atual.length === 0) {
      atual.push(p);
      bytesAtual = teste;
      continue;
    }
    saida.push({ nome: nomeParte(base, atual), bytes: bytesAtual! });
    atual = [p];
    bytesAtual = await extrair(origem, atual);
  }
  if (atual.length) saida.push({ nome: nomeParte(base, atual), bytes: bytesAtual! });
  return saida;
}

export type NivelCompressao = 'leve' | 'recomendada' | 'maxima';
export const NIVEIS: Record<NivelCompressao, { rotulo: string; detalhe: string; escala: number; qualidade: number }> = {
  leve: { rotulo: 'Leve', detalhe: 'Melhor qualidade, redução menor', escala: 2, qualidade: 0.82 },
  recomendada: { rotulo: 'Recomendada', detalhe: 'Boa leitura e bom tamanho para protocolo', escala: 1.5, qualidade: 0.68 },
  maxima: { rotulo: 'Máxima', detalhe: 'Menor arquivo possível, pode perder nitidez', escala: 1.1, qualidade: 0.5 },
};

async function pdfjs() {
  const lib = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

// Cada página vira uma imagem JPG (é o que reduz digitalizações e fotos de documentos).
// O texto deixa de ser selecionável; se o resultado ficar maior, devolve a versão só reorganizada.
export async function comprimir(f: File, nivel: NivelCompressao, aoProgredir?: (feito: number, total: number) => void): Promise<{ bytes: Uint8Array; rasterizado: boolean }> {
  const { PDFDocument } = await pdfLib();
  const original = new Uint8Array(await f.arrayBuffer());
  const reorganizado = await (await abrir(f)).save({ useObjectStreams: true });

  const { escala, qualidade } = NIVEIS[nivel];
  const lib = await pdfjs();
  const fonte = await lib.getDocument({ data: original.slice() }).promise;
  const doc = await PDFDocument.create();
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  for (let i = 1; i <= fonte.numPages; i++) {
    aoProgredir?.(i - 1, fonte.numPages);
    const pagina = await fonte.getPage(i);
    const tamanho = pagina.getViewport({ scale: 1 });
    const vp = pagina.getViewport({ scale: escala });
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', qualidade));
    const img = await doc.embedJpg(await blob.arrayBuffer());
    doc.addPage([tamanho.width, tamanho.height]).drawImage(img, { x: 0, y: 0, width: tamanho.width, height: tamanho.height });
    pagina.cleanup();
  }
  await fonte.destroy();
  const rasterizado = await doc.save();
  const menor = [rasterizado, reorganizado, original].reduce((a, b) => (b.length < a.length ? b : a));
  return { bytes: menor, rasterizado: menor === rasterizado };
}

export function baixar(nome: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
