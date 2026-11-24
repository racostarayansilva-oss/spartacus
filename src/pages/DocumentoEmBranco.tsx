// Editor de documento em branco: folha A4 com a marca d'água do escritório, barra de formatação,
// atalhos para cabeçalho, qualificação do cliente, local e data, assinatura e tabela.
// O rascunho fica guardado neste navegador; "Imprimir / PDF" usa o mesmo layout dos modelos.
import { MouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Topo } from '../components/ui';
import { Icone } from '../components/icones';
import { useBanco } from '../store';
import { CABECALHO, preencher } from '../lib/modelos';
import { imprimirDocumento, marcaDagua } from '../lib/modelosEstilo';
import { useDadosDocumento } from '../dadosDocumento';

const CHAVE_RASCUNHO = 'spartacus:rascunho-documento';
const VAZIO = '<p><br></p>';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ESTADOS = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'] as const;

const BLOCOS: [string, string][] = [['p', 'Parágrafo'], ['h1', 'Título'], ['h2', 'Subtítulo'], ['blockquote', 'Citação recuada']];
const TAMANHOS: [string, string][] = [['2', '10'], ['3', '12'], ['4', '14'], ['5', '18'], ['6', '24']];

const QUALIFICACAO = {
  id: 'qualificacao', nome: '', descricao: '',
  html: '<p><b>{{nome}}</b>, brasileiro(a), {{estadoCivil}}, {{profissao}}, portador(a) do RG nº {{rg}}, inscrito(a) no CPF sob o nº {{cpf}}, residente e domiciliado(a) à {{endereco}}, nº {{numero}}, bairro {{bairro}}, {{cidade}}/{{uf}}, CEP {{cep}}, telefone {{telefone}}.</p>',
};

function lerRascunho(): { titulo: string; html: string } | null {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null');
    return r && typeof r.html === 'string' ? r : null;
  } catch { return null; }
}

export default function DocumentoEmBranco({ aoVoltar }: { aoVoltar: () => void }) {
  const rascunho = useMemo(lerRascunho, []);
  const dadosDoc = useDadosDocumento();
  const [titulo, setTitulo] = useState(rascunho?.titulo || 'Novo documento');
  const editor = useRef<HTMLDivElement>(null);
  const selecao = useRef<Range | null>(null);
  const [ativos, setAtivos] = useState<Set<string>>(new Set());
  const [bloco, setBloco] = useState('p');
  const [tamanho, setTamanho] = useState('3');
  const [palavras, setPalavras] = useState(0);
  const [vazio, setVazio] = useState(true);
  const [salvoEm, setSalvoEm] = useState('');
  const [escolherCliente, setEscolherCliente] = useState(false);
  const espera = useRef<number>();

  const contar = useCallback(() => {
    const texto = editor.current?.innerText.trim() ?? '';
    setPalavras(texto ? texto.split(/\s+/).length : 0);
    setVazio(!texto && !editor.current?.querySelector('img,table,.linha-assinatura'));
  }, []);

  useEffect(() => {
    if (editor.current) editor.current.innerHTML = rascunho?.html || VAZIO;
    contar();
  }, [rascunho, contar]);

  const salvar = useCallback(() => {
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ titulo, html: editor.current?.innerHTML ?? '' }));
        setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* sem armazenamento: o texto fica só na tela */ }
    }, 600);
  }, [titulo]);

  useEffect(() => { salvar(); }, [titulo, salvar]);

  // Mantém a última seleção dentro da folha e acende os botões do que está aplicado no cursor
  useEffect(() => {
    const aoSelecionar = () => {
      const s = document.getSelection();
      if (!s?.rangeCount || !editor.current?.contains(s.anchorNode)) return;
      selecao.current = s.getRangeAt(0).cloneRange();
      setAtivos(new Set(ESTADOS.filter((c) => { try { return document.queryCommandState(c); } catch { return false; } })));
      const b = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '');
      setBloco(BLOCOS.some(([v]) => v === b) ? b : 'p');
      setTamanho(document.queryCommandValue('fontSize') || '3');
    };
    document.addEventListener('selectionchange', aoSelecionar);
    return () => document.removeEventListener('selectionchange', aoSelecionar);
  }, []);

  const restaurar = () => {
    editor.current?.focus();
    const s = document.getSelection();
    if (selecao.current && s) { s.removeAllRanges(); s.addRange(selecao.current); }
  };

  const cmd = (comando: string, valor?: string) => {
    restaurar();
    document.execCommand(comando, false, valor);
    contar();
    salvar();
  };

  const inserir = (html: string) => cmd('insertHTML', html);

  const hojeExtenso = () => { const d = new Date(); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };

  const novo = () => {
    if (!vazio && !confirm('Começar um documento novo? O texto atual será descartado.')) return;
    if (editor.current) editor.current.innerHTML = VAZIO;
    setTitulo('Novo documento');
    try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
    contar();
  };

  const imprimir = () => {
    if (!imprimirDocumento(titulo, editor.current?.innerHTML ?? '')) alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
  };

  const manter = (e: MouseEvent) => e.preventDefault(); // o clique na barra não tira o cursor da folha
  /** Botão da barra: `acao` é um comando do editor (string) ou uma função. */
  const ferr = (rotulo: string, conteudo: string | ReactNode, acao: string | (() => void)) => {
    const ligado = typeof acao === 'string' && ativos.has(acao);
    return (
      <button
        type="button" className={`ferr${ligado ? ' ativo' : ''}`} title={rotulo} aria-label={rotulo}
        aria-pressed={typeof acao === 'string' && (ESTADOS as readonly string[]).includes(acao) ? ligado : undefined}
        onMouseDown={manter} onClick={typeof acao === 'string' ? () => cmd(acao) : acao}
      >
        {typeof conteudo === 'string' ? <Icone nome={conteudo} tamanho={17} /> : conteudo}
      </button>
    );
  };

  return (
    <>
      <Topo titulo="Documento em branco" subtitulo="Escreva, formate e salve como PDF. O rascunho fica guardado neste navegador.">
        <button className="btn fantasma" onClick={aoVoltar}><Icone nome="seta-esq" tamanho={16} />Voltar</button>
        <button className="btn" onClick={novo}>Novo</button>
        <button className="btn primario" onClick={imprimir}><Icone nome="imprimir" tamanho={16} />Imprimir / PDF</button>
      </Topo>

      <div className="editor">
        <input className="editor-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título do documento" placeholder="Título do documento (vira o nome do PDF)" />

        <div className="editor-barra" role="toolbar" aria-label="Formatação">
          <div className="grupo">
            {ferr('Desfazer (Ctrl+Z)', 'desfazer', 'undo')}
            {ferr('Refazer (Ctrl+Y)', 'refazer', 'redo')}
          </div>
          <div className="grupo">
            <select value={bloco} onChange={(e) => cmd('formatBlock', `<${e.target.value}>`)} aria-label="Estilo do parágrafo" className="sel-bloco">
              {BLOCOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <select value={tamanho} onChange={(e) => cmd('fontSize', e.target.value)} aria-label="Tamanho da letra" className="sel-tamanho">
              {TAMANHOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div className="grupo">
            {ferr('Negrito (Ctrl+B)', <b>N</b>, 'bold')}
            {ferr('Itálico (Ctrl+I)', <i style={{ fontFamily: 'Georgia, serif' }}>I</i>, 'italic')}
            {ferr('Sublinhado (Ctrl+U)', <u>S</u>, 'underline')}
            {ferr('Tachado', <s>T</s>, 'strikeThrough')}
          </div>
          <div className="grupo">
            {ferr('Alinhar à esquerda', 'al-esq', 'justifyLeft')}
            {ferr('Centralizar', 'al-centro', 'justifyCenter')}
            {ferr('Alinhar à direita', 'al-dir', 'justifyRight')}
            {ferr('Justificar', 'al-just', 'justifyFull')}
          </div>
          <div className="grupo">
            {ferr('Lista com marcadores', 'lista', 'insertUnorderedList')}
            {ferr('Lista numerada', 'lista-num', 'insertOrderedList')}
            {ferr('Diminuir recuo', 'recuo-menos', 'outdent')}
            {ferr('Aumentar recuo', 'recuo-mais', 'indent')}
          </div>
          <div className="grupo">
            {ferr('Cabeçalho do escritório', 'detalhe', () => inserir(preencher({ id: 'cab', nome: '', descricao: '', html: CABECALHO }, {}, dadosDoc) + VAZIO))}
            {ferr('Qualificação do cliente', 'clientes', () => setEscolherCliente(true))}
            {ferr('Local e data de hoje', 'calendario', () => inserir(`<p class="local-data" style="text-align:right">São Luís (MA), ${hojeExtenso()}.</p>`))}
            {ferr('Linha de assinatura', 'assinatura', () => inserir('<div class="linha-assinatura">______________________________________________</div><div class="legenda-assinatura">NOME</div>' + VAZIO))}
            {ferr('Tabela', 'tabela', () => inserir(`<table class="tabela-doc"><tbody>${'<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3)}</tbody></table>${VAZIO}`))}
            {ferr('Quebra de página', 'quebra-pagina', () => inserir(`<div class="quebra-pagina"></div>${VAZIO}`))}
          </div>
          <div className="grupo">
            {ferr('Limpar formatação', 'limpar-formato', 'removeFormat')}
          </div>
        </div>

        <div className="editor-mesa">
          <div className="editor-folha">
            <div className="editor-marca" aria-hidden="true" dangerouslySetInnerHTML={{ __html: marcaDagua() }} />
            <div
              ref={editor}
              className={`editor-conteudo${vazio ? ' vazio' : ''}`}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Texto do documento"
              spellCheck
              onInput={() => { contar(); salvar(); }}
            />
          </div>
        </div>

        <div className="editor-status">
          <span className="num">{palavras} {palavras === 1 ? 'palavra' : 'palavras'}</span>
          <span>{salvoEm ? `Rascunho salvo neste navegador às ${salvoEm}` : 'O rascunho é salvo automaticamente neste navegador'}</span>
        </div>
      </div>

      {escolherCliente && (
        <EscolherCliente
          aoFechar={() => setEscolherCliente(false)}
          aoEscolher={(html) => { setEscolherCliente(false); setTimeout(() => inserir(html), 0); }}
        />
      )}
    </>
  );
}

function EscolherCliente({ aoFechar, aoEscolher }: { aoFechar: () => void; aoEscolher: (html: string) => void }) {
  const b = useBanco();
  const dadosDoc = useDadosDocumento();
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const digitos = q.replace(/\D/g, '');
  const lista = b.clientes.filter((c) => !q || c.nome.toLowerCase().includes(q) || (!!digitos && c.cpf.includes(digitos))).slice(0, 30);
  return (
    <Modal titulo="Qualificação do cliente" aoFechar={aoFechar}>
      <p className="mudo" style={{ margin: 0 }}>Insere no cursor o parágrafo de qualificação com os dados do cadastro. O que faltar aparece como lacuna para completar.</p>
      <input autoFocus placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <ul className="lista escolha-cliente">
        {lista.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => aoEscolher(preencher(QUALIFICACAO, c, dadosDoc))}>
              <strong>{c.nome}</strong>
              <span className="mono mudo">{c.cpf}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="vazio">Nenhum cliente encontrado.</li>}
      </ul>
    </Modal>
  );
}
