# RA Connect

Software jurídico da **RA Costa Advocacia & Consultoria** (São Luís/MA, Tomé-Açu/PA e Breves/PA).
Reúne controladoria e prazos (como o ADVBox), gestão de processos e atendimento (como o Astrea) e gestão de casos (como o Legis), com foco em **previdenciário rural de alto volume** (INSS, JEF/TRF1).

- Documento do projeto: [docs/PROJETO.md](docs/PROJETO.md)
- Serviços a contratar para ter os mesmos dados dos concorrentes: [docs/SERVICOS-A-CONTRATAR.md](docs/SERVICOS-A-CONTRATAR.md)

## Página inicial e acesso

Sem login, `/` mostra a página inicial (com prévia que calcula um prazo real a partir de hoje) e o botão **Entrar** leva a `/entrar`. Links diretos (ex.: `/processos/123`) vão direto ao login e abrem a página pedida depois de entrar. `/inicio` mostra a página inicial mesmo para quem já entrou.

## O que já funciona (versão 0.1)

| Módulo | Situação |
|---|---|
| **Painel** | Filtro Hoje/7/30 dias; entradas (WhatsApp e todos os canais), protocolos, audiências, recursos, dilações, exigências; resultados e taxa de procedência; "Atenção agora"; audiências com marcações e alerta vermelho a 7 dias; carga da equipe (Diamante); botão **Registrar movimentação** para cada pessoa lançar a produção do dia |
| **Central do WhatsApp** | Classificação (andamento, protocolo, documentos, audiência, outros), ligação ao cliente/processo, **resposta pronta** com fase, última movimentação e audiência; catálogo de protocolos pedidos com "Marcar protocolado" (conta no Painel); alarmes "pediu 3x" e "cliente enviada por dois corretores". Recebimento real depende da API do WhatsApp |
| **Controladoria** | Caixa de intimações; busca **automática no DJEN pela OAB** (gratuita, testada com intimações reais); cada intimação vira prazo com responsável e data fatal |
| **Prazos e agenda** | Calculadora em dias úteis (CPC 219, 220, 224) e corridos (INSS); feriados nacionais, forenses, MA/PA e municipais cadastráveis; recesso 20/12–20/01; compromissos com origem, responsável e status |
| **Processos** | Base única (JEF, cível, trabalhista, administrativo INSS); indicadores do grupo familiar; quadro Corretores e regiões; **ficha** com vida do processo, dias de vida/até decisão/parado, grupo familiar com **triagem automática** (aposentadoria rural 55/60, salário-maternidade, BPC 65+) e **Atualizar pelo DataJud**; **editar** e **excluir** processo (com busca e cadastro de cliente no próprio formulário) e **corrigir/remover etapa** (o Painel acompanha); aba **Revisar fases**: lê as comunicações do DJEN, o DataJud e as intimações e sugere as etapas (citação, audiência, sentença com resultado, recurso, RPV/cumprimento) para aplicar em lote; **Resumo Inteligente** (Gemini, gerado só quando alguém clica; pontos de atenção calculados pelo sistema; não envia nome, CPF ou telefone) e **Valores e provisionamento** com a capa do DataJud (classe, assuntos, órgão, ajuizamento) |
| **Tarefas** | Quadro com **Todas as tarefas, Hoje, Próximos dias, Fazendo e Concluídas hoje** (arrastar muda situação e prazo); resumo Finalizadas/Pendentes/Pontos do mês; alertas de intimações, prazos e audiências; busca e filtro (minhas/equipe/etiqueta); cartão com etiquetas coloridas, cliente e processo, prazo ("Hoje", "Ontem" em vermelho), várias pessoas, comentários e histórico; abas Visão Geral, Lista, Desempenho (placar Diamante) e Configurações (etiquetas). Tarefas também na ficha do processo e criadas automaticamente ao gerar prazo na Controladoria |
| **Clientes** | Funil Lead → Atendimento → Contrato → Caso ativo; origem (tráfego, corretor, indicação) |
| **Financeiro** | Receitas, despesas, a receber, recebido, saldo previsto; **honorários sobre RPV** (Diamante) |
| **Normas** | Busca em **234.914 normas federais** (Constituição, emendas, leis, LCs, decretos-leis, decretos, MPs, decretos legislativos e resoluções do Senado, desde o Império) por número ("8.213/91"), apelido ("CLT", "LOAS", "RPS") ou assunto ("aposentadoria rural"); "art. 48 da 8213" abre já no artigo. Ficha de cada norma com texto oficial pesquisável (normas.leg.br), alterações e regulamentações e publicação (Senado); normas fixadas pela equipe; 24 fichas do escritório |
| **Decisões por CPF** | Validação do CPF, regras de acesso (cliente só o próprio; equipe só os clientes dela), registro de toda consulta, exclusão de segredo de justiça. Precisa de um provedor contratado |
| **Integrações** | Status de cada API e testes no próprio app |

**Dois modos:** com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas, os dados ficam no Supabase, com login, papéis (advogado, equipe) e atualização em tempo real entre a equipe. Sem elas, o app abre em **modo de testes**, com dados de exemplo guardados no navegador.

**Para colocar no ar:** siga [docs/PASSO-A-PASSO.md](docs/PASSO-A-PASSO.md).

## Catálogo de normas

O catálogo fica em `server/dados/normas-federais.json.gz` (Dados Abertos do Senado). Para atualizar:

```bash
npm run normas:atualizar -- 2026        # só o ano atual (rápido), junta com o que já existe
npm run normas:atualizar                # tudo de novo (~3 min)
```

Depois é só fazer commit do arquivo. Instruções normativas do INSS e portarias não estão no cadastro do Senado (ficam nas fichas do escritório).

## Rodar no computador

```bash
npm install
cp .env.example .env   # opcional: chaves das integrações pagas
npm run dev            # abre em http://localhost:5173
npm test               # testes das regras (prazos, CPF, CNJ, triagem, RPV, WhatsApp)
```

## Publicar (Supabase + Vercel)

Passo a passo completo em [docs/PASSO-A-PASSO.md](docs/PASSO-A-PASSO.md). Resumo:

1. Criar um projeto Supabase (São Paulo) e rodar [supabase/schema.sql](supabase/schema.sql) no SQL Editor. O primeiro login criado vira administrador.
2. Em vercel.com, importar este repositório e cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Cada `git push` na `main` publica. As funções rodam em São Paulo (`gru1`) e, com o Supabase ligado, toda rota `/api` exige login.

## Rotas da API

| Rota | Fonte | Função |
|---|---|---|
| `GET /api/status` | — | Quais integrações estão configuradas |
| `GET /api/processo/:numero` | DataJud | Capa e movimentações pelo número CNJ |
| `GET /api/publicacoes?oab=&uf=&inicio=&fim=` | DJEN (CNJ) | Intimações pela OAB |
| `POST /api/cpf` `{cpf}` | Judit, Escavador, Vigilant ou Jusneural | Processos em que o CPF é parte |
| `GET /api/norma?urn=&art=` | normas.leg.br | Texto oficial de um artigo |
| `GET /api/norma/indice?urn=` | normas.leg.br | Lista dos dispositivos da lei |
| `GET /api/senado/norma?urn=` | Senado/LexML | Identificação oficial da norma |
| `GET /api/tst?q=` | TST | Jurisprudência |
| `GET /api/tcu?q=` | TCU | Acórdãos |
| `GET /api/carf?processo=` | CARF | Acórdãos pelo processo |
| `GET /api/camara?q=` | Câmara | Projetos de lei |
| `GET /api/stj?q=` | STJ | Dados abertos |

## Estrutura

```
api/router.ts            função única da Vercel (todas as rotas /api)
server/rotas.ts          tabela de rotas
server/integracoes/      DataJud, DJEN, normas.leg.br, jurisprudência, CPF
src/lib/                 regras de negócio puras + testes
src/pages/               telas
src/store.ts             dados do app (navegador no modo de testes)
src/nuvem.ts             Supabase: login, carga, gravação e tempo real
server/auth.ts           login nas rotas /api
supabase/schema.sql      banco, papéis e regras de acesso
```

## Próximos passos

1. Portal do cliente (login com papel "cliente" vendo só o próprio CPF e processos).
2. Webhook do WhatsApp (`/api/whatsapp/webhook`) depois de contratar a API.
3. Busca diária automática no DJEN (Vercel Cron) e alerta de intimação nova.
4. Leitura dos e-mails do Meu INSS → exigências como prazo.
5. Conferir os feriados locais de São Luís, Tomé-Açu e Breves e o calendário do TRF1/TJMA/TJPA de 2027.

## Observações

- O produto não usa a palavra "Monumental" (é só da unidade do escritório).
- Feriados estaduais e Corpus Christi aparecem como **"conferir"** no cálculo de prazos.
- Depois das ADIs 2110 e 2111 (STF), confirme a regra atual da IN sobre carência do salário-maternidade da segurada especial.
