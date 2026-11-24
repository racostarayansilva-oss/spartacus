// Ícones de traço simples (24×24), desenhados para o Spartacus.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const caminhos: Record<string, JSX.Element> = {
  inicio: <><path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>,
  comprimir: <><path d="M4 14h6v6M20 10h-6V4" /><path d="M14 10l7-7M3 21l7-7" /></>,
  tesoura: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5L20 18M8.5 16.5L20 6" /></>,
  imagem: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  camadas: <><path d="M12 3l9 5-9 5-9-5Z" /><path d="M3 13l9 5 9-5" /></>,
  cnis: <><path d="M7 3h7l4 4v14H7Z" /><path d="M13 3v5h5" /><path d="M10 18v-3M12.5 18v-5M15 18v-2" /></>,
  reordenar: <><path d="M8 4v16M4 8l4-4 4 4" /><path d="M16 20V4M20 16l-4 4-4-4" /></>,
  'seta-cima': <><path d="M5 15l7-7 7 7" /></>,
  'seta-baixo': <><path d="M5 9l7 7 7-7" /></>,
  upload:<><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  fechar: <><path d="M6 6l12 12M18 6L6 18" /></>,
  sino: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  email:<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
  chave: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2" /></>,
  olho: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'olho-fechado': <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  copiar: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  clipe: <><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></>,
  painel: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  whatsapp: <><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12Z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.8" /></>,
  controladoria: <><path d="M4 4h16v12H8l-4 4Z" /><path d="M8 9h8M8 12h5" /></>,
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  processos: <><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  tarefas: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5a3 3 0 0 1 0 6M18 14.5a5.5 5.5 0 0 1 3.5 5.5" /></>,
  financeiro: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14.5" r="1.5" /></>,
  normas: <><path d="M12 4v16M5 7h14" /><path d="M5 7l-3 6h6ZM19 7l-3 6h6Z" /><path d="M8 20h8" /></>,
  cpf: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2.2" /><path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 10h3M15 13h3" /></>,
  crm: <><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M19 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-3" /></>,
  documentos: <><path d="M7 3h7l4 4v14H7Z" /><path d="M13 3v5h5" /><path d="M10 12h5M10 15h5M10 18h3" /></>,
  speak: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3M8 21h8" /></>,
  producao: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /><path d="M14 8l3-3 3 3" /></>,
  mais: <><path d="M12 5v14M5 12h14" /></>,
  editar: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="M13.5 6.5l4 4" /></>,
  lixeira: <><path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  'seta-esq': <><path d="M15 5l-7 7 7 7" /></>,
  'seta-dir': <><path d="M9 5l7 7-7 7" /></>,
  baixar: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
  imprimir: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7Z" /></>,
  enviar: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4Z" /></>,
  fogo: <><path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-2 4-2 5-1-1-2-2-2-4-2 2-4 5-4 9a6 6 0 0 0 6 6Z" /></>,
  // Editor de documentos
  'al-esq': <><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></>,
  'al-centro': <><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></>,
  'al-dir': <><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></>,
  'al-just': <><path d="M4 6h16M4 10h16M4 14h16M4 18h16" /></>,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  'lista-num': <><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 4.5l1.5-1V8M3.5 13.5c0-1 2.5-1.5 2.5 0 0 1-2.5 2-2.5 3h2.5" /></>,
  'recuo-mais': <><path d="M10 6h10M10 12h10M10 18h10M4 9l3 3-3 3" /></>,
  'recuo-menos': <><path d="M10 6h10M10 12h10M10 18h10M7 9l-3 3 3 3" /></>,
  tabela: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M10 4v16" /></>,
  desfazer: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  refazer: <><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>,
  'limpar-formato': <><path d="M6 4h12M12 4l-4 16M4 20h8" /><path d="M15 14l6 6M21 14l-6 6" /></>,
  assinatura: <><path d="M3 17c3-6 5-9 6-9s-1 8 1 8 3-5 5-5-1 4 1 4 3-2 4-2" /><path d="M3 21h18" /></>,
  'quebra-pagina': <><path d="M6 3v5h12V3M6 21v-5h12v5" /><path d="M3 12h3M9 12h2M13 12h2M18 12h3" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" /></>,
  integracoes: <><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0Z" /><path d="M12 16v5" /></>,
  // Quadro de tarefas
  feito: <><path d="M3 13l4 4L17 7" /><path d="M11 15l2 2 8-10" /></>,
  relogio: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pontos: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  busca: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  filtro: <><path d="M4 5h16l-6 7.5V19l-4-2v-4.5Z" /></>,
  caixa: <><path d="M4 13l2.5-8h11L20 13v6H4Z" /><path d="M4 13h5l1 2h4l1-2h5" /></>,
  alvo: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  martelo: <><path d="M13 5l6 6M10.5 7.5l6 6M12 6.5l4.5 4.5" /><path d="M11.5 12L4 19.5" /><path d="M14 4l6 6-2.5 2.5-6-6Z" /></>,
  detalhe: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  historico: <><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></>,
  comentario: <><path d="M10 9L5 13l5 4" /><path d="M5 13h9a5 5 0 0 1 5 5v1" /></>,
  recarregar: <><path d="M20 11a8 8 0 0 0-14.6-4.4L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.4L20 16" /><path d="M20 20v-4h-4" /></>,
  concluir: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>,
  config: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
};

export function Icone({ nome, tamanho }: { nome: keyof typeof caminhos | string; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...P} width={tamanho} height={tamanho}>
      {caminhos[nome] ?? null}
    </svg>
  );
}

export function Logo({ tamanho = 34 }: { tamanho?: number }) {
  return <img src="/logo.png" width={tamanho} height={tamanho} alt="" style={{ borderRadius: 8 }} />;
}
