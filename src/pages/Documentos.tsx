// Hub dos documentos: escolhe entre Editor em branco, Robô Gerador e A partir de um modelo.
import { useSearchParams } from 'react-router-dom';
import { Topo } from '../components/ui';
import { Icone } from '../components/icones';
import RoboDocumentos from './RoboDocumentos';
import DocumentoEmBranco from './DocumentoEmBranco';

type Tela = 'inicio' | 'branco' | 'robo' | 'modelo';

export default function Documentos() {
  // A tela fica no endereço: o "voltar" do navegador volta para o hub, não sai de Documentos
  const [params, setParams] = useSearchParams();
  const tela: Tela = (['branco', 'robo', 'modelo'] as Tela[]).find((t) => t === params.get('tela')) ?? 'inicio';
  const setTela = (t: Tela) => setParams(t === 'inicio' ? {} : { tela: t });

  if (tela === 'branco') return <DocumentoEmBranco aoVoltar={() => setTela('inicio')} />;
  if (tela === 'robo' || tela === 'modelo') return <RoboDocumentos aoVoltar={() => setTela('inicio')} />;

  return (
    <>
      <Topo titulo="Novo documento" subtitulo="Escolha como deseja criar seu documento" />
      <div className="grid-cartoes">
        <button className="cartao-opcao" onClick={() => setTela('branco')}>
          <div className="icone-caixa verde"><Icone nome="detalhe" /></div>
          <div>
            <h3>Documento em branco</h3>
            <p>Escreva do zero, no editor, com atalhos para pegar dados do cliente.</p>
          </div>
        </button>
        <button className="cartao-opcao" onClick={() => setTela('robo')}>
          <div className="icone-caixa azul"><Icone nome="documentos" /></div>
          <div>
            <h3>Robô gerador de documentos</h3>
            <p>Gera procurações, contratos, declarações e outros, já preenchidos com os dados do cliente.</p>
          </div>
        </button>
        <button className="cartao-opcao" onClick={() => setTela('modelo')}>
          <div className="icone-caixa laranja"><Icone nome="normas" /></div>
          <div>
            <h3>A partir de um modelo</h3>
            <p>Comece de um modelo do escritório.</p>
          </div>
        </button>
      </div>
    </>
  );
}
