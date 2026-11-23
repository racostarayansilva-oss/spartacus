# RA Connect — Documento do Projeto

## 1. Visão geral

**RA Connect** é um software jurídico próprio da **RA Costa Advocacia & Consultoria**, com unidades em São Luís/MA, Tomé-Açu/PA e Breves/PA. O responsável é o Dr. Rômulo Alves Costa (OAB/MA 14.427 | OAB/PA 30.733-A).

O produto tem dois usos:
- **Uso interno** do escritório.

Ele reúne em um só sistema o que hoje está espalhado em três concorrentes:

| Concorrente | Ponto forte que o RA Connect absorve |
|---|---|
| **ADVBox** | Controladoria jurídica, leitura de intimações, cálculo de prazos e pontuação de produtividade (Taskscore) |
| **Astrea (Aurum)** | Gestão de processos e atendimento ao cliente (agenda, contatos, atendimentos, financeiro) |
| **Legis Synergy** | Gestão de casos tradicional |

**Diferencial:** foco em previdenciário rural de alto volume, no INSS e no JEF/TRF1. Isso inclui exigência do INSS como prazo, honorários sobre RPV, corretores parceiros, a Central do WhatsApp e a análise do grupo familiar do CadÚnico. Também atende as áreas cível e trabalhista.

**Idioma:** todo o produto em português do Brasil.

> Os serviços que precisam ser contratados para obter os mesmos dados de Legis, Astrea e Tramitação Inteligente estão em [SERVICOS-A-CONTRATAR.md](SERVICOS-A-CONTRATAR.md).

---

## 2. Identidade visual

- **Avatar:** monograma "RA" em serifa clássica com uma balança pendurada, e embaixo "RA CONNECT / SOFTWARE JURÍDICO".
- **Cores:**
  - Preto: `#0B0B0F`
  - Violeta da balança: `#3F3FA8` no tema claro e `#9A9AF0` no tema escuro
  - Branco: `#F2F2F5`
- **Fontes:**
  - Cinzel, para a marca
  - Cormorant Garamond, para os títulos
  - IBM Plex Sans e IBM Plex Mono, para texto e números
- **Regra:** o produto não usa a palavra "Monumental", que é só da unidade do escritório.
- **Temas:** claro e escuro. No celular, a navegação fica na parte de baixo.

---

## 3. Módulos e funcionalidades

### 3.1 Painel
- Filtro de período: Hoje, 7 dias e 30 dias.
- **Entrada e produção:** entradas pelo WhatsApp (e o total de todos os canais), processos protocolados, audiências marcadas e recursos interpostos, dilação de prazo, cumprimento de exigência. Cada funcionário deve conseguir cadastrar sua produção diária.
- **Resultados:** despachos (quantos foram favoráveis), sentenças (procedentes, parciais e improcedentes) e taxa de procedência.
- **Atenção agora:** prazos vencendo hoje, intimações sem tratar, audiências sem contato nos próximos 7 dias e honorários a receber.
- **Audiências:** para cada uma, mostra o cliente, as testemunhas com telefone e duas marcações, "Cliente contatado" e "Testemunhas confirmadas". Se faltar contato a 7 dias da data, fica em vermelho.
- Últimas movimentações, próximos prazos e carga da equipe (esta última só no Diamante).
- Botão **Registrar movimentação**, com os tipos entrada (e canal), protocolo, despacho, sentença, recurso e audiência (com as testemunhas).

### 3.2 Central do WhatsApp (CRM)
- Recebe as mensagens dos números do escritório e classifica cada pedido:
  - **Consulta de andamento:** "como anda meu processo?", "me dê notícias", "verifica meu processo".
  - **Pedido de protocolo:** "doutor, protocola pra mim".
  - **Envio de documentos**, **audiência** e **outros**.
- Liga a mensagem ao processo do cliente e monta uma **resposta pronta**, com a fase atual, a última movimentação e a audiência marcada. A resposta é assinada com o nome do escritório.
- **Catálogo de protocolos pedidos:** mostra o cliente, quem pediu, quantas vezes, o primeiro pedido e a situação. O botão "Marcar protocolado" já soma no painel.
- **Alarmes:**
  - Mesmo corretor pedindo o mesmo protocolo mais de uma vez, como "pediu 3x".
  - A mesma cliente enviada por dois corretores diferentes.

### 3.3 Controladoria
- Caixa de intimações: cada publicação vira um prazo, com responsável e data fatal calculada.
- **Regra de prazo:**
  - A publicação conta no 1º dia útil após a disponibilização no DJe.
  - O prazo começa no dia útil seguinte (CPC, arts. 219 e 224).
  - Pula fins de semana, feriados nacionais e o recesso de 20/12 a 20/01 (CPC, art. 220).
  - Feriados locais do MA e do PA devem ser conferidos.

### 3.4 Prazos e agenda
- Calculadora de prazo em dias úteis.
- Compromissos com origem (judicial, INSS, audiência ou interno), responsável e status.
- Exigência do INSS tratada como prazo (30 dias; ver a IN 212/2026).

### 3.5 Processos
- Base única para processos judiciais (JEF, cível e trabalhista) e requerimentos administrativos do INSS.
- Cada processo tem número CNJ ou NB, cliente, tipo, assunto, fase, responsável, valor, **corretor** e **região**.
- Indicadores do grupo familiar: aposentadorias rurais possíveis, salários-maternidade possíveis, BPC idoso possível e corretores ativos.
- Quadro **Corretores e regiões**: para cada corretor, as regiões, o número de processos e as sentenças procedentes.
- **Ficha do processo:**
  - **Vida do processo:** cada etapa com a data e os dias desde a anterior. As etapas variam por tipo:
    - **JEF:** Entrada → Documentação → DER no INSS → Decisão INSS → Ajuizamento → Citação/contestação → Audiência/perícia → Sentença → Recurso → RPV/pagamento.
    - **Administrativo INSS:** Entrada → Documentação → DER → Exigência → Decisão INSS → Recurso.
    - **Cível:** Entrada → Ajuizamento → Citação/contestação → Réplica → Audiência/perícia → Sentença → Recurso → Cumprimento.
    - **Trabalhista:** Entrada → Ajuizamento → Audiência/perícia → Sentença → Recurso → Execução.
  - **Indicadores da ficha:** dias de vida, dias da entrada até a decisão e há quantos dias o processo está parado.
  - **Grupo familiar (CadÚnico):** nome, parentesco, sexo, nascimento, último parto e parto previsto. O sistema faz uma triagem automática:
    - Aposentadoria rural: aos 55 anos (mulher) ou 60 (homem). Mostra quem já atingiu e quem completa nos próximos 5 anos, com a data.
    - Salário-maternidade: parto nos últimos 5 anos (com a data-limite) e gestantes.
    - BPC idoso: 65 anos ou mais.
  - Botão **Atualizar pelo DataJud**, com as movimentações oficiais.
  - Registrar uma etapa de sentença, recurso, DER ou ajuizamento alimenta o painel.

### 3.6 Tarefas
- Kanban com as colunas A fazer, Fazendo, Revisão e Concluído.
- Cada tarefa tem **pontos** pela complexidade (1, 2, 3, 5 ou 8). Há um placar de produtividade por pessoa (Diamante).
- Inspirado no Legis.

### 3.7 Clientes e atendimento
- Funil: Lead → Atendimento → Contrato assinado → Caso ativo.
- Casos personalizados.
- Origem do cliente: tráfego pago, corretor parceiro, indicação.

### 3.8 Financeiro
- Receitas, despesas, valores a receber, valores recebidos e saldo previsto.
- Calculadora de **honorários sobre RPV**: valor da RPV × percentual contratual, separando os honorários do líquido do cliente (Diamante).

### 3.9 Normas
- 24 fichas de consulta rápida, com busca por palavra e filtro por área (INSS, Previdenciário, Assistencial, CPC, JEF).
- **Conteúdo:**
  - **INSS:** IN PRES/INSS 128/2022 (norma geral) e IN 212/2026, de 06/08/2026. A IN 212 trouxe: exigência sem resposta em 30 dias pode encerrar o pedido sem análise de mérito; pensão ao filho nascido após o óbito; Anexo III do auxílio-acidente passa a ser exemplificativo; regras para advogado procurador. Também o Decreto 3.048/99, art. 305 (recurso ao CRPS em 30 dias).
  - **Lei 8.213/91:** art. 11, VII (segurado especial); art. 48 (aposentadoria rural 55/60, carência de 180 meses); arts. 39 e 71 (salário-maternidade); art. 55, §3º com a Súmula 149 do STJ (início de prova material); Súmula 577 do STJ; art. 106 (autodeclaração); art. 74 (pensão em 90/180 dias); art. 103 (decadência e prescrição).
  - **LOAS:** art. 20 (BPC, renda de 1/4 do salário mínimo e flexibilização).
  - **CPC:** arts. 219, 220, 224, 1.003 e 1.023 (15 dias, embargos em 5), 335, 485 e 486, 487, 98 e 99, 300.
  - **JEF:** Lei 10.259/01, art. 3º (até 60 salários mínimos) e art. 17 (RPV em 60 dias); Lei 9.099/95, arts. 12-A e 42 (recurso inominado em 10 dias).
- Cada ficha tem "Copiar referência", link para o texto oficial e **"Ver texto da lei"**, que traz o texto oficial do artigo pelo normas.leg.br.
- **Ponto de atenção:** depois das ADIs 2110 e 2111 (STF), a carência do salário-maternidade mudou. É preciso confirmar a regra atual da IN para a segurada especial.

### 3.10 Decisões por CPF
- Quem está logado informa o CPF e vê os processos e decisões em que aparece como parte, em qualquer tribunal.
- O CPF é validado pelos dígitos verificadores.
- **Regras de acesso:**
  - O cliente vê só o próprio CPF.
  - O advogado vê os CPFs dos clientes dele (LGPD, art. 7º, V e VI).
  - Toda consulta fica registrada.
  - Processos em segredo de justiça ficam de fora.

### 3.11 Integrações
- Mostra o status de cada API e tem testes no próprio app: DataJud por número, jurisprudência do TST e do TCU, e projetos de lei na Câmara.

### Rotas da API

| Rota | Fonte | Função |
|---|---|---|
| `GET /api/status` | — | Mostra quais integrações estão configuradas |
| `GET /api/processo/:numero` | DataJud | Capa e movimentações pelo número CNJ |
| `POST /api/cpf` `{cpf}` | Judit, Escavador, Vigilant ou Jusneural | Processos em que o CPF é parte |
| `GET /api/norma?urn=&art=` | normas.leg.br | Texto oficial de um artigo |
| `GET /api/norma/indice?urn=` | normas.leg.br | Lista dos dispositivos da lei |
| `GET /api/senado/norma?urn=` | Senado/LexML | Identificação oficial da norma |
| `GET /api/tst?q=` | TST | Jurisprudência por palavras |
| `GET /api/tcu?q=` | TCU | Acórdãos |
| `GET /api/carf?processo=` | CARF | Acórdãos pelo número do processo |
| `GET /api/camara?q=` | Câmara | Projetos de lei |
| `GET /api/stj?q=` | STJ | Conjuntos de dados abertos |

### Detalhes das integrações

- **DataJud:** `POST https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search`, com o header `Authorization: APIKey {chave pública}` e consulta Elasticsearch. O alias vem do próprio número CNJ: J=4 vira `trf{TR}`; J=8 vira o TJ da UF (10 = `tjma`, 14 = `tjpa`); J=5 vira `trt{TR}`. **Não busca por CPF.**
- **Judit:** `https://requests.prod.judit.io/requests`, com o header `api-key`. A requisição é assíncrona: cria o pedido, acompanha até concluir e depois busca as respostas.
- **Escavador:** API v2, `GET /envolvido/processos?cpf_cnpj=`, com token Bearer.
- **Vigilant:** `POST /api/v1/consults`, com token Bearer `vgl_...`.
- **Jusneural:** `POST https://app.jusneural.com/api/api-jusneural/consultar`, com token Bearer e tempo-limite de 120 s.
- **normas.leg.br:** `GET https://normas.leg.br/api/public/normas?urn={URN}&tipo_documento=maior-detalhe`. Retorna uma árvore JSON-LD, que é percorrida por `hasPart`. O texto fica em `workExample.text`, e o dispositivo é o sufixo depois de `!` (ex.: `art48`). *Observação da implementação:* leis antigas (ex.: Lei 8.213) vêm sem a árvore; nesses casos o texto é recortado da compilação vigente em HTML (`encoding` → `contentUrl`).
- **Senado/LexML:** `GET https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn={URN}`.
- **TST:** `POST https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual/{inicio}/{tamanho}`. O corpo tem os campos `e` (termo), `tipos:["ACORDAO"]` e `orgao:"TST"`, e `numeracaoUnica.orgao:"5"` é obrigatório.
- **TCU:** `GET .../acordao-completo/documentosResumidos?termo=&ordenacao=&quantidade=&inicio=`.
- **CARF:** Solr em `.../solr/acordaos2/select?q=numero_processo_s:"..."&wt=json`.
- **DJEN (acrescentado na implementação):** `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=&ufOab=&dataDisponibilizacaoInicio=&dataDisponibilizacaoFim=`, gratuito, base da caixa de intimações.
- **URNs usadas:**
  - Lei 8.213: `urn:lex:br:federal:lei:1991-07-24;8213`
  - LOAS: `urn:lex:br:federal:lei:1993-12-07;8742`
  - CPC: `urn:lex:br:federal:lei:2015-03-16;13105`
  - Lei 10.259: `urn:lex:br:federal:lei:2001-07-12;10259`
  - Lei 9.099: `urn:lex:br:federal:lei:1995-09-26;9099`
  - Decreto 3.048: `urn:lex:br:federal:decreto:1999-05-06;3048`
- **Fora do escopo:** APIs estrangeiras (CourtListener, OpenCaseLaw, Lex UK, Moonlit, nu:legal). A Codilo só libera a documentação depois do contrato.
- **Referência técnica:** os contratos de TST, TCU, CARF, Senado e normas.leg.br seguem o projeto aberto **br-eli-mcp**, confirmado em julho de 2026.
