// CSS único para a pré-visualização e para a página aberta no "Imprimir / PDF".

/** Monograma "RA" da logo do escritório (R grafite, A dourado e os dois traços), sem o fundo escuro. */
export const MONOGRAMA_RA = `<svg viewBox="6 8 52 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <text x="11" y="42" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" fill="#2B2B2B">R</text>
  <text x="31" y="38" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#A87C00">A</text>
  <path d="M10 46 Q26 54 42 47" stroke="#A87C00" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M38 47 Q46 44 54 49" stroke="#A87C00" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;

const MARCA_DAGUA = `<div class="marca-dagua">${MONOGRAMA_RA}</div>`;

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Página completa do documento. `previa` desenha a folha A4 na tela; sem ela, sai pronta para imprimir. */
export function documentoHtml(titulo: string, corpo: string, previa = false): string {
  const conteudo = `${MARCA_DAGUA}<div class="conteudo">${corpo}</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>${estiloImpressao()}</style></head><body>${previa ? `<div class="folha">${conteudo}</div>` : conteudo}</body></html>`;
}

/** Abre o documento numa janela nova e chama a impressão (o "Salvar como PDF" fica no diálogo do navegador). */
export function imprimirDocumento(titulo: string, corpo: string) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(documentoHtml(titulo, corpo));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

export function estiloImpressao(): string {
  return `
    @page { size: A4; margin: 2cm 1.8cm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #111; margin: 0; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .marca-dagua { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .marca-dagua svg { width: 125mm; max-width: 80%; opacity: 0.07; }
    .conteudo { position: relative; z-index: 1; }
    .cabecalho { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #bfa14a; padding-bottom: 8px; margin-bottom: 20px; }
    .cabecalho img { height: 56px; }
    .cabecalho .contato { font-size: 10pt; text-align: right; color: #333; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; margin: 16px 0 24px; letter-spacing: 0.5px; }
    h2 { font-size: 12pt; text-transform: uppercase; margin: 18px 0 8px; }
    p { text-align: justify; margin: 10px 0; }
    blockquote { margin: 12px 0 12px 4cm; font-size: 11pt; text-align: justify; line-height: 1.3; }
    ul, ol { margin: 8px 0; padding-left: 1.6em; }
    table { border-collapse: collapse; }
    .tabela-doc { width: 100%; margin: 10px 0; }
    .tabela-doc td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
    .qualificacao { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 11pt; }
    .qualificacao td { border: 1px solid #333; padding: 4px 6px; }
    .lacuna { color: #666; letter-spacing: 1px; }
    .local-data { margin-top: 36px; }
    .linha-assinatura { text-align: center; margin-top: 48px; letter-spacing: 1px; }
    .legenda-assinatura { text-align: center; font-weight: bold; margin-top: 2px; font-size: 11pt; }
    .testemunhas { display: flex; justify-content: space-around; gap: 24px; margin-top: 40px; }
    .testemunhas .linha-assinatura { margin-top: 0; }
    .rodape { margin-top: 24px; border-top: 2px solid #bfa14a; padding-top: 6px; }
    .quebra-pagina { page-break-after: always; break-after: page; }
    @media screen {
      body { background: #e6e7ea; padding: 32px; }
      .folha { position: relative; background: #fff; max-width: 210mm; margin: 0 auto; padding: 2cm 1.8cm; min-height: 297mm; box-shadow: 0 2px 20px rgba(0,0,0,.15); }
      .folha .marca-dagua { position: absolute; }
      .quebra-pagina { border-top: 1px dashed #bbb; margin: 24px 0; }
    }
  `;
}
