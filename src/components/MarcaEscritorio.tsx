// White label: nome, logo e cores do escritório. O formulário é o mesmo na implantação (plataforma)
// e em Configurações (administrador do escritório).
import { useState } from 'react';
import { contraste, corValida, Marca, MARCA_PADRAO, nomeExibido, tokensDaMarca, useMarca } from '../marca';
import { salvarMarca } from '../nuvem';
import { alterar, usuarioAtual, useBanco } from '../store';

/** Reduz a imagem para no máximo 256 px (PNG) para caber no banco sem pesar no carregamento. */
export function lerLogo(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(arquivo.type)) return falha(new Error('Use PNG, JPG, WebP ou SVG.'));
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error('Não foi possível ler a imagem.'));
    leitor.onload = () => {
      const url = String(leitor.result);
      if (arquivo.type === 'image/svg+xml') {
        if (url.length > 250_000) return falha(new Error('SVG grande demais (máx. 180 KB).'));
        return ok(url);
      }
      const img = new Image();
      img.onerror = () => falha(new Error('Imagem inválida.'));
      img.onload = () => {
        const lado = Math.min(256, Math.max(img.width, img.height));
        const escala = lado / Math.max(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/png'));
      };
      img.src = url;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function CampoCor({ rotulo, valor, padrao, aoMudar }: { rotulo: string; valor?: string; padrao: string; aoMudar: (v: string) => void }) {
  const atual = corValida(valor) ? valor : padrao;
  return (
    <label className="campo">
      {rotulo}
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={atual} onChange={(e) => aoMudar(e.target.value.toUpperCase())} style={{ width: 44, height: 36, padding: 2 }} aria-label={`${rotulo} (seletor)`} />
        <input value={valor ?? ''} placeholder={padrao} onChange={(e) => aoMudar(e.target.value.trim())} style={{ fontFamily: 'var(--fonte-mono)' }} aria-label={`${rotulo} (código)`} />
      </span>
    </label>
  );
}

/** Prévia da barra lateral e do botão com as cores escolhidas. */
export function PreviaMarca({ marca }: { marca: Marca }) {
  const t = tokensDaMarca(marca);
  const primaria = t.claro['--primario'];
  const ajustada = corValida(marca.corPrimaria) && primaria.toLowerCase() !== marca.corPrimaria.toLowerCase();
  return (
    <div className="previa-marca">
      <div className="previa-lateral" style={{ background: t.comum['--lateral'] }}>
        <span className="previa-logo">{marca.logo ? <img src={marca.logo} alt="" /> : <img src="/logo.svg" alt="" />}</span>
        <b>{nomeExibido(marca)}</b>
        <span className="previa-item ativo" style={{ color: t.comum['--lateral-ativo'], boxShadow: `inset 3px 0 0 ${t.comum['--destaque']}`, background: t.comum['--lateral-2'] }}>Área de trabalho</span>
        <span className="previa-item">Processos</span>
      </div>
      <div className="previa-corpo">
        <button type="button" className="btn" style={{ background: primaria, color: t.claro['--sobre-primario'], borderColor: primaria }}>Novo processo</button>
        <button type="button" className="btn" style={{ background: t.comum['--destaque'], color: t.comum['--sobre-destaque'], borderColor: t.comum['--destaque'] }}>Destaque</button>
        <a style={{ color: t.claro['--link'] }}>Link de exemplo</a>
        {ajustada && <p className="mudo" style={{ margin: 0, fontSize: 12 }}>A cor principal foi escurecida para manter o texto legível (contraste {contraste(marca.corPrimaria!, '#ffffff').toFixed(1)}:1 era baixo).</p>}
      </div>
    </div>
  );
}

export function FormMarca({ marca, aoMudar }: { marca: Marca; aoMudar: (m: Marca) => void }) {
  const [erro, setErro] = useState('');
  const set = (p: Partial<Marca>) => aoMudar({ ...marca, ...p });
  return (
    <div className="form-marca">
      <div className="grade-2">
        <label className="campo">Nome do escritório<input value={marca.nome ?? ''} onChange={(e) => set({ nome: e.target.value })} placeholder="Silva & Souza Advocacia" /></label>
        <label className="campo">Nome curto (barra lateral)<input value={marca.nomeCurto ?? ''} maxLength={22} onChange={(e) => set({ nomeCurto: e.target.value })} placeholder="SILVA & SOUZA" /></label>
        <label className="campo">Subtítulo<input value={marca.subtitulo ?? ''} maxLength={30} onChange={(e) => set({ subtitulo: e.target.value })} placeholder={MARCA_PADRAO.subtitulo} /></label>
        <label className="campo">Rodapé (OAB, cidade)<input value={marca.rodape ?? ''} onChange={(e) => set({ rodape: e.target.value })} placeholder="OAB/SP 123.456 · São Paulo/SP" /></label>
        <CampoCor rotulo="Cor principal" valor={marca.corPrimaria} padrao={MARCA_PADRAO.corPrimaria} aoMudar={(v) => set({ corPrimaria: v })} />
        <CampoCor rotulo="Cor de destaque" valor={marca.corDestaque} padrao={MARCA_PADRAO.corDestaque} aoMudar={(v) => set({ corDestaque: v })} />
        <label className="campo">Logo (quadrado, PNG/SVG)
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={async (e) => {
                setErro('');
                const f = e.target.files?.[0];
                if (!f) return;
                try { set({ logo: await lerLogo(f) }); } catch (er: any) { setErro(er.message); }
              }} />
            {marca.logo && <button type="button" className="btn pequeno fantasma" onClick={() => set({ logo: undefined })}>Remover</button>}
          </span>
        </label>
      </div>
      {erro && <div className="erro">{erro}</div>}
      <PreviaMarca marca={marca} />
    </div>
  );
}

/** Configurações → Marca do escritório (só o administrador altera). */
export function MarcaEscritorio() {
  const b = useBanco();
  const { escritorio, marca: atual } = useMarca();
  const admin = usuarioAtual(b)?.papel === 'advogado';
  const [marca, setMarca] = useState<Marca>(() => ({ ...(escritorio?.marca || {}), nome: escritorio?.marca?.nome || escritorio?.nome }));
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  if (!escritorio) return null;
  if (!admin) {
    return (
      <div className="cartao">
        <h3>Marca do escritório</h3>
        <p className="mudo">{atual.nome}. Só o administrador altera o logo e as cores.</p>
      </div>
    );
  }
  const salvar = async () => {
    setSalvando(true); setEstado(null);
    try {
      await salvarMarca(marca);
      setEstado({ tipo: 'ok', texto: 'Marca salva. A equipe vê a mudança ao recarregar a página.' });
    } catch (e: any) { setEstado({ tipo: 'erro', texto: e.message }); }
    setSalvando(false);
  };
  return (
    <div className="cartao">
      <h3>Marca do escritório</h3>
      <p className="mudo" style={{ marginTop: 0 }}>Nome, logo e cores que a equipe vê no sistema e na tela de entrada ({window.location.host}).</p>
      <FormMarca marca={marca} aoMudar={setMarca} />
      {estado && <div className={estado.tipo === 'ok' ? 'aviso' : 'erro'} role="status" style={{ marginTop: 10 }}>{estado.texto}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar marca'}</button>
        <button className="btn fantasma" onClick={() => setMarca({ nome: marca.nome })}>Voltar às cores Spartacus</button>
      </div>
    </div>
  );
}

/** Configurações → Dados nos documentos: contato do cabeçalho, qualificação do advogado e foro. */
export function DadosDocumentos() {
  const b = useBanco();
  const admin = usuarioAtual(b)?.papel === 'advogado';
  const [d, setD] = useState(b.config.documentos || {});
  const [salvo, setSalvo] = useState(false);
  const mudou = JSON.stringify(d) !== JSON.stringify(b.config.documentos || {});
  return (
    <div className="cartao">
      <h3>Dados nos documentos</h3>
      <p className="mudo" style={{ marginTop: 0 }}>Entram na procuração, no contrato de honorários e no cabeçalho dos documentos.</p>
      <div className="form-marca">
        <label className="campo">Qualificação do(s) advogado(s) — outorgado/contratado
          <textarea rows={3} value={d.qualificacao || ''} disabled={!admin} onChange={(e) => { setD({ ...d, qualificacao: e.target.value }); setSalvo(false); }}
            placeholder="FULANO DE TAL, brasileiro, advogado, inscrito na OAB/SP sob o nº 123.456, com escritório na Rua X, 100, São Paulo/SP." />
        </label>
        <div className="grade-2">
          <label className="campo">Contato no cabeçalho (uma linha por informação)
            <textarea rows={2} value={d.contato || ''} disabled={!admin} onChange={(e) => { setD({ ...d, contato: e.target.value }); setSalvo(false); }} placeholder={'(11) 3000-0000\ncontato@escritorio.adv.br'} />
          </label>
          <label className="campo">Foro do contrato (comarca)
            <input value={d.foro || ''} disabled={!admin} onChange={(e) => { setD({ ...d, foro: e.target.value }); setSalvo(false); }} placeholder="São Paulo/SP" />
          </label>
        </div>
      </div>
      {admin && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button className="btn primario" disabled={!mudou} onClick={() => { alterar((db) => { db.config.documentos = d; }); setSalvo(true); }}>Salvar</button>
          {salvo && !mudou && <span className="mudo">Salvo.</span>}
        </div>
      )}
    </div>
  );
}
