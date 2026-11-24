# Sistema visual do Spartacus

Baseado numa análise de "interface de galeria": a interface recua e o conteúdo (prazos, processos, clientes) fala. Adaptado para um sistema de trabalho denso e white label.

## Princípios

- **Uma cor de ação só**: `--primario`, a cor do escritório. Links, botões principais, item ativo do menu, foco. Nada mais usa cor de marca.
- **Destaque (verde-limão por padrão) é assinatura**, não ação: aparece só sobre faixas escuras (número de abertura da Área de trabalho, numeração da página inicial).
- **A troca de superfície é o divisor**: fundo pergaminho `#f5f5f7`, cartões brancos com fio `#e5e5ea`, faixa quase preta `#1d1d1f` para abrir a Área de trabalho e a seção "Como funciona".
- **Sem sombra na interface.** A única sombra (`--sombra-objeto`: `rgba(0,0,0,.22) 3px 5px 30px`) fica em objetos apoiados numa superfície: a folha do editor de documentos e a prévia do produto na página inicial.
- **Sem gradientes decorativos.**
- **Barras fixas em vidro fosco** (`backdrop-filter: saturate(180%) blur(20px)`): lateral, topo, barra do celular, painéis suspensos.

## Tipografia

Fonte do sistema (SF Pro no Mac/iPhone), Inter nos demais. Pesos 300/400/600/700, sem 500.

| Uso | Tamanho | Peso | Espaçamento |
|---|---|---|---|
| Abertura (Área de trabalho, página inicial) | 48–64px | 600 | −0,03em |
| Título de página (h1) | 34px | 600 | −0,022em |
| Título de seção/cartão (h2) | 21px | 600 | −0,012em |
| Texto | 15px / 1,47 | 400 | −0,01em |
| Legenda | 12–13px | 400 | — |

## Formas

| Token | Valor | Uso |
|---|---|---|
| `--raio-sm` | 8px | logos, utilitários pequenos |
| `--raio-md` | 11px | campos de formulário, itens de lista |
| `--raio-xl` | 18px | cartões, modais, faixas |
| `--raio-pilula` | 980px | botões, busca, abas, etiquetas, item do menu |

## Componentes

- **Botão principal**: pílula na cor primária. **Secundário**: cápsula pérola com fio. **Fantasma**: texto na cor de link. Ao pressionar, `scale(0.95)`.
- **Abas**: fichas em pílula; a ativa é preenchida com a cor do texto.
- **Segmentado** (Meus/Equipe): trilho cinza, opção ativa branca.
- **Foco**: contorno de 2px na cor primária.
- Toque mínimo de 44px no celular.

Tema escuro: preto `#000`, superfícies `#1d1d1f`/`#272729`, a cor primária é clareada por `src/marca.ts` até ter contraste 4,5:1.
