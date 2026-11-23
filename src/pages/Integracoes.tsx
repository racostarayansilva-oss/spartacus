import { useEffect, useState } from 'react';
import { api } from '../api';
import { Topo } from '../components/ui';

const NOMES: Record<string, [string, string]> = {
  datajud: ['DataJud (CNJ)', 'Capa e movimentações pelo número CNJ. Gratuito.'],
  djen: ['DJEN / Comunica PJe (CNJ)', 'Intimações por OAB, usadas na Controladoria. Gratuito.'],
  normas: ['normas.leg.br', 'Texto oficial dos artigos. Gratuito.'],
  senado: ['Senado / LexML', 'Identificação oficial da norma. Gratuito.'],
  tst: ['TST', 'Jurisprudência por palavras. Gratuito.'],
  tcu: ['TCU', 'Acórdãos. Gratuito.'],
  carf: ['CARF', 'Acórdãos pelo número do processo. Gratuito.'],
  camara: ['Câmara dos Deputados', 'Projetos de lei. Gratuito.'],
  stj: ['STJ — dados abertos', 'Conjuntos de dados abertos. Gratuito.'],
  gemini: ['Gemini (Google)', 'Resumo Inteligente do processo. Pago por uso — precisa de GEMINI_API_KEY.'],
  cpf: ['Consulta por CPF', 'Judit, Escavador, Vigilant ou Jusneural. Pago — precisa de contrato e chave.'],
};

type Teste = { id: string; rotulo: string; placeholder: string; padrao: string; rota: (v: string) => string; dica?: string };
const TESTES: Teste[] = [
  { id: 'datajud', rotulo: 'DataJud por número', placeholder: 'Número CNJ', padrao: '', rota: (v) => `processo/${encodeURIComponent(v)}`, dica: 'O servidor do CNJ tem levado de 30 a 50 segundos para responder.' },
  { id: 'tst', rotulo: 'Jurisprudência do TST', placeholder: 'Palavras', padrao: 'trabalhador rural', rota: (v) => `tst?q=${encodeURIComponent(v)}` },
  { id: 'tcu', rotulo: 'Acórdãos do TCU', placeholder: 'Palavras', padrao: 'aposentadoria rural', rota: (v) => `tcu?q=${encodeURIComponent(v)}` },
  { id: 'camara', rotulo: 'Projetos de lei na Câmara', placeholder: 'Palavras', padrao: 'segurado especial', rota: (v) => `camara?q=${encodeURIComponent(v)}` },
  { id: 'stj', rotulo: 'Dados abertos do STJ', placeholder: 'Palavras', padrao: 'precedentes', rota: (v) => `stj?q=${encodeURIComponent(v)}` },
  { id: 'carf', rotulo: 'CARF por processo', placeholder: 'Número do processo administrativo', padrao: '', rota: (v) => `carf?processo=${encodeURIComponent(v)}` },
];

export default function Integracoes() {
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api('status').then(setStatus).catch((e) => setErro(e.message));
  }, []);

  return (
    <>
      <Topo titulo="Integrações" subtitulo="Status de cada API e testes direto no app." />
      {erro && <div className="erro" style={{ marginBottom: 12 }}>Servidor da API indisponível: {erro}</div>}
      <div className="cartao tabela-wrap">
        <table>
          <thead><tr><th>Fonte</th><th>Uso</th><th>Status</th></tr></thead>
          <tbody>
            {Object.entries(NOMES).map(([k, [nome, desc]]) => {
              const s = status?.[k];
              return (
                <tr key={k}>
                  <td><strong>{nome}</strong></td>
                  <td className="mudo">{desc}{k === 'cpf' && s?.provedores?.length ? ` Configurados: ${s.provedores.join(', ')}.` : ''}</td>
                  <td>{!status ? '…' : s?.configurado ? <span className="etiqueta verde">configurado</span> : <span className="etiqueta ambar">não configurado</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 className="secao">Testes</h2>
      <div className="grade g2 mt">{TESTES.map((t) => <CaixaTeste key={t.id} t={t} />)}</div>
    </>
  );
}

function CaixaTeste({ t }: { t: Teste }) {
  const [v, setV] = useState(t.padrao);
  const [res, setRes] = useState<string>('');
  const [carregando, setCarregando] = useState(false);
  const rodar = async () => {
    if (!v.trim()) return;
    setCarregando(true);
    setRes('');
    const inicio = performance.now();
    try {
      const r = await api(t.rota(v.trim()));
      setRes(`✓ ${Math.round(performance.now() - inicio)} ms\n` + JSON.stringify(r, null, 2).slice(0, 3000));
    } catch (e: any) {
      setRes(`✕ ${e.message}`);
    } finally {
      setCarregando(false);
    }
  };
  return (
    <div className="cartao">
      <h3>{t.rotulo}</h3>
      <div className="flex">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t.placeholder} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && rodar()} />
        <button className="btn" onClick={rodar} disabled={carregando}>{carregando ? 'Consultando…' : 'Testar'}</button>
      </div>
      {t.dica && <p className="mudo" style={{ margin: '8px 0 0' }}>{t.dica}</p>}
      {res && <pre className="pre mono mt" style={{ maxHeight: 260, overflow: 'auto', fontSize: '0.75rem' }}>{res}</pre>}
    </div>
  );
}
