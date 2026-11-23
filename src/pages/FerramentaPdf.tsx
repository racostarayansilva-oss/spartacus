// Ferramentas de PDF (comprimir, dividir, converter imagens e juntar). Tudo roda no navegador.
import { DragEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../components/icones';
import { Campo, Segmentos, Topo } from '../components/ui';
import {
  baixar, comprimir, contarPaginas, dividir, ehImagem, ehPdf, imagensParaPdf, juntar, ModoDivisao, NivelCompressao, NIVEIS, OpcoesImagem, Saida, semExtensao, tamanhoLegivel,
} from '../lib/pdf';

export type TipoFerramenta = 'comprimir' | 'dividir' | 'imagens' | 'juntar';

const INFO: Record<TipoFerramenta, { titulo: string; subtitulo: string; aceita: string; varios: boolean; dica: string }> = {
  comprimir: { titulo: 'Comprimir PDFs', subtitulo: 'Reduza o tamanho de digitalizações e fotos de documentos.', aceita: 'application/pdf,.pdf', varios: true, dica: 'Solte aqui um ou mais PDFs' },
  dividir: { titulo: 'Dividir PDFs', subtitulo: 'Separe um PDF por intervalos de páginas, a cada N páginas ou por tamanho máximo.', aceita: 'application/pdf,.pdf', varios: false, dica: 'Solte aqui o PDF que será dividido' },
  imagens: { titulo: 'Converter imagens em PDF', subtitulo: 'Fotos de RG, comprovantes e laudos viram um único PDF, na ordem da lista.', aceita: 'image/jpeg,image/png,image/webp,image/gif,image/bmp', varios: true, dica: 'Solte aqui as imagens (JPG, PNG ou WebP)' },
  juntar: { titulo: 'Juntar PDFs', subtitulo: 'Una vários PDFs e imagens em um único arquivo, na ordem da lista.', aceita: 'application/pdf,.pdf,image/jpeg,image/png,image/webp', varios: true, dica: 'Solte aqui os PDFs e imagens' },
};

type Item = { id: string; arquivo: File; paginas?: number };
type Resultado = { saidas: (Saida & { antes?: number; aviso?: string })[]; nota?: string };

export default function FerramentaPdf({ tipo }: { tipo: TipoFerramenta }) {
  const info = INFO[tipo];
  const [itens, setItens] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nivel, setNivel] = useState<NivelCompressao>('recomendada');
  const [modo, setModo] = useState<ModoDivisao['tipo']>('intervalos');
  const [intervalos, setIntervalos] = useState('');
  const [porArquivo, setPorArquivo] = useState(10);
  const [mb, setMb] = useState(5);
  const [img, setImg] = useState<OpcoesImagem>({ pagina: 'a4', margem: 20 });
  const [nome, setNome] = useState('');
  const entrada = useRef<HTMLInputElement>(null);

  const aceito = (f: File) => (tipo === 'imagens' ? ehImagem(f) : tipo === 'juntar' ? ehPdf(f) || ehImagem(f) : ehPdf(f));

  const adicionar = async (lista: FileList | File[]) => {
    setErro(''); setResultado(null);
    const todos = Array.from(lista);
    const validos = todos.filter(aceito);
    if (validos.length < todos.length) setErro(`${todos.length - validos.length} arquivo(s) ignorado(s): formato não aceito nesta ferramenta.`);
    if (!validos.length) return;
    const novos = validos.map((arquivo) => ({ id: `${arquivo.name}-${arquivo.size}-${Math.random().toString(36).slice(2, 7)}`, arquivo }));
    setItens((x) => (info.varios ? [...x, ...novos] : novos.slice(0, 1)));
    if (!nome) setNome(semExtensao(validos[0].name));
    for (const n of novos.filter((i) => ehPdf(i.arquivo))) {
      contarPaginas(n.arquivo)
        .then((p) => setItens((x) => x.map((i) => (i.id === n.id ? { ...i, paginas: p } : i))))
        .catch((e) => setErro(e.message));
    }
  };

  const soltar = (e: DragEvent) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); };
  const mover = (i: number, d: -1 | 1) => setItens((x) => { const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y; });
  const remover = (id: string) => { setItens((x) => x.filter((i) => i.id !== id)); setResultado(null); };
  const limpar = () => { setItens([]); setResultado(null); setErro(''); setNome(''); };

  const nomeFinal = (sufixo = '') => `${(nome.trim() || 'documento').replace(/[\\/:*?"<>|]/g, '-')}${sufixo}.pdf`;

  const executar = async () => {
    setErro(''); setResultado(null);
    try {
      if (tipo === 'comprimir') {
        const saidas: Resultado['saidas'] = [];
        for (const [k, it] of itens.entries()) {
          const r = await comprimir(it.arquivo, nivel, (f, t) => setProgresso(`Comprimindo ${itens.length > 1 ? `arquivo ${k + 1} de ${itens.length}, ` : ''}página ${f + 1} de ${t}…`));
          const aviso = r.bytes.length >= it.arquivo.size ? 'Este arquivo já estava otimizado; a versão original foi mantida.' : r.rasterizado ? undefined : 'Arquivo reorganizado sem perda de qualidade.';
          saidas.push({ nome: `${semExtensao(it.arquivo.name)} - comprimido.pdf`, bytes: r.bytes, antes: it.arquivo.size, aviso });
        }
        setResultado({ saidas, nota: 'Na compressão, as páginas viram imagem: o texto deixa de ser selecionável. Guarde o original.' });
      } else if (tipo === 'dividir') {
        const m: ModoDivisao = modo === 'intervalos' ? { tipo: 'intervalos', texto: intervalos } : modo === 'paginas' ? { tipo: 'paginas', n: porArquivo } : { tipo: 'tamanho', mb };
        const saidas = await dividir(itens[0].arquivo, m, (f, t) => setProgresso(`Separando ${f + 1} de ${t}…`));
        const grande = m.tipo === 'tamanho' ? saidas.filter((s) => s.bytes.length > mb * 1024 * 1024).length : 0;
        setResultado({ saidas, nota: grande ? `${grande} página(s) sozinha(s) já passam de ${mb} MB. Comprima essas partes antes de enviar.` : undefined });
      } else if (tipo === 'imagens') {
        setProgresso('Montando o PDF…');
        setResultado({ saidas: [{ nome: nomeFinal(), bytes: await imagensParaPdf(itens.map((i) => i.arquivo), img) }] });
      } else {
        const bytes = await juntar(itens.map((i) => i.arquivo), (i) => setProgresso(`Juntando arquivo ${i + 1} de ${itens.length}…`));
        setResultado({ saidas: [{ nome: nomeFinal(), bytes }] });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível processar os arquivos.');
    } finally {
      setProgresso(null);
    }
  };

  const total = itens.reduce((s, i) => s + i.arquivo.size, 0);
  const paginas = itens.reduce((s, i) => s + (i.paginas ?? (ehImagem(i.arquivo) ? 1 : 0)), 0);
  const pronto = itens.length > 0 && (tipo !== 'juntar' || itens.length > 1) && (tipo !== 'dividir' || modo !== 'intervalos' || intervalos.trim());
  const rotuloAcao = { comprimir: 'Comprimir', dividir: 'Dividir', imagens: 'Gerar PDF', juntar: 'Juntar arquivos' }[tipo];

  return (
    <>
      <Link to="/" className="btn fantasma pequeno voltar"><Icone nome="seta-esq" tamanho={15} />Área de trabalho</Link>
      <Topo titulo={info.titulo} subtitulo={info.subtitulo} />

      <div className="pdf-layout">
        <div className="cartao">
          <div
            className={`pdf-soltar ${arrastando ? 'ativo' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            onClick={() => entrada.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
          >
            <Icone nome="upload" tamanho={26} />
            <b>{info.dica}</b>
            <span>ou clique para escolher {info.varios ? 'os arquivos' : 'o arquivo'}</span>
            <input ref={entrada} type="file" hidden accept={info.aceita} multiple={info.varios} onChange={(e) => { if (e.target.files) adicionar(e.target.files); e.target.value = ''; }} />
          </div>

          {itens.length > 0 && (
            <>
              <div className="pdf-lista-cab">
                <span className="mudo">{itens.length} arquivo{itens.length > 1 ? 's' : ''} · {tamanhoLegivel(total)}{paginas ? ` · ${paginas} página${paginas > 1 ? 's' : ''}` : ''}</span>
                <button className="btn fantasma pequeno" onClick={limpar}>Limpar</button>
              </div>
              <ol className="pdf-lista">
                {itens.map((it, i) => (
                  <li key={it.id}>
                    <span className="pdf-ordem num">{i + 1}</span>
                    <Icone nome={ehPdf(it.arquivo) ? 'documentos' : 'imagem'} tamanho={18} />
                    <span className="pdf-nome">
                      <b title={it.arquivo.name}>{it.arquivo.name}</b>
                      <span className="mudo">{tamanhoLegivel(it.arquivo.size)}{it.paginas ? ` · ${it.paginas} pág.` : ''}</span>
                    </span>
                    {info.varios && itens.length > 1 && (
                      <>
                        <button className="icone-btn" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" title="Subir"><Icone nome="seta-cima" tamanho={14} /></button>
                        <button className="icone-btn" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label="Descer" title="Descer"><Icone nome="seta-baixo" tamanho={14} /></button>
                      </>
                    )}
                    <button className="icone-btn" onClick={() => remover(it.id)} aria-label={`Remover ${it.arquivo.name}`} title="Remover"><Icone nome="fechar" tamanho={14} /></button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <div className="cartao pdf-opcoes">
          <h3>Opções</h3>
          {tipo === 'comprimir' && (
            <div className="pdf-niveis" role="radiogroup" aria-label="Nível de compressão">
              {(Object.keys(NIVEIS) as NivelCompressao[]).map((k) => (
                <label key={k} className={nivel === k ? 'ativo' : ''}>
                  <input type="radio" name="nivel" checked={nivel === k} onChange={() => setNivel(k)} />
                  <span><b>{NIVEIS[k].rotulo}</b><span>{NIVEIS[k].detalhe}</span></span>
                </label>
              ))}
            </div>
          )}

          {tipo === 'dividir' && (
            <>
              <Segmentos valor={modo} aoMudar={setModo} opcoes={[['intervalos', 'Intervalos'], ['paginas', 'N páginas'], ['tamanho', 'Tamanho']]} />
              <div className="mt">
                {modo === 'intervalos' && (
                  <Campo rotulo="Páginas de cada arquivo">
                    <input value={intervalos} onChange={(e) => setIntervalos(e.target.value)} placeholder="Ex.: 1-3, 4-10, 11-" />
                  </Campo>
                )}
                {modo === 'intervalos' && <p className="mudo pdf-ajuda">Cada intervalo vira um arquivo. "11-" vai da página 11 até o fim.</p>}
                {modo === 'paginas' && <Campo rotulo="Páginas por arquivo"><input type="number" min={1} value={porArquivo} onChange={(e) => setPorArquivo(Math.max(1, Number(e.target.value) || 1))} /></Campo>}
                {modo === 'tamanho' && (
                  <>
                    <Campo rotulo="Tamanho máximo de cada parte (MB)"><input type="number" min={0.5} step={0.5} value={mb} onChange={(e) => setMb(Math.max(0.5, Number(e.target.value) || 5))} /></Campo>
                    <p className="mudo pdf-ajuda">Use o limite por arquivo do sistema onde vai protocolar (PJe, Meu INSS etc.).</p>
                  </>
                )}
              </div>
            </>
          )}

          {tipo === 'imagens' && (
            <div className="grade" style={{ gap: 12 }}>
              <Campo rotulo="Tamanho da página">
                <select value={img.pagina} onChange={(e) => setImg({ ...img, pagina: e.target.value as OpcoesImagem['pagina'] })}>
                  <option value="a4">A4 (recomendado)</option>
                  <option value="imagem">Mesmo tamanho da imagem</option>
                </select>
              </Campo>
              {img.pagina === 'a4' && (
                <Campo rotulo="Margem">
                  <select value={img.margem} onChange={(e) => setImg({ ...img, margem: Number(e.target.value) })}>
                    <option value={0}>Sem margem</option><option value={20}>Pequena</option><option value={45}>Normal</option>
                  </select>
                </Campo>
              )}
            </div>
          )}

          {(tipo === 'imagens' || tipo === 'juntar') && (
            <div className="mt"><Campo rotulo="Nome do arquivo final"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="documento" /></Campo></div>
          )}

          {tipo === 'juntar' && itens.length === 1 && <p className="mudo pdf-ajuda">Adicione pelo menos mais um arquivo para juntar.</p>}

          <button className="btn primario pdf-executar" onClick={executar} disabled={!pronto || !!progresso}>
            {progresso ? 'Processando…' : rotuloAcao}
          </button>
          {progresso && <p className="mudo pdf-ajuda" aria-live="polite">{progresso}</p>}
          {erro && <div className="erro mt">{erro}</div>}
          <p className="pdf-privado"><Icone nome="concluir" tamanho={14} />Os arquivos são processados neste computador e não são enviados a nenhum servidor.</p>
        </div>
      </div>

      {resultado && (
        <div className="cartao secao">
          <div className="cartao-cab">
            <h3>Pronto</h3>
            {resultado.saidas.length > 1 && <button className="btn" onClick={() => resultado.saidas.forEach((s, i) => setTimeout(() => baixar(s.nome, s.bytes), i * 350))}><Icone nome="baixar" tamanho={16} />Baixar todos ({resultado.saidas.length})</button>}
          </div>
          <ul className="pdf-resultado">
            {resultado.saidas.map((s) => {
              const reducao = s.antes ? Math.round((1 - s.bytes.length / s.antes) * 100) : null;
              return (
                <li key={s.nome}>
                  <span className="pdf-nome">
                    <b>{s.nome}</b>
                    <span className="mudo num">
                      {s.antes ? `${tamanhoLegivel(s.antes)} → ${tamanhoLegivel(s.bytes.length)}` : tamanhoLegivel(s.bytes.length)}
                      {reducao !== null && reducao > 0 && <span className="pdf-reducao"> · {reducao}% menor</span>}
                    </span>
                    {s.aviso && <span className="mudo">{s.aviso}</span>}
                  </span>
                  <button className="btn pequeno" onClick={() => baixar(s.nome, s.bytes)}><Icone nome="baixar" tamanho={14} />Baixar</button>
                </li>
              );
            })}
          </ul>
          {resultado.nota && <p className="mudo pdf-ajuda">{resultado.nota}</p>}
        </div>
      )}
    </>
  );
}
