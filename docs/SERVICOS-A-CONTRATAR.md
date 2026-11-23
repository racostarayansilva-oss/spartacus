# Serviços a contratar para ter os mesmos dados dos concorrentes

Levantamento feito em 04/11/2026 para o RA Connect. Compara o que Legis, Astrea (Aurum), ADVBox e Tramitação Inteligente entregam com o que precisamos contratar para obter o mesmo tipo de informação.

**Resumo:** boa parte dos dados é pública e gratuita e já está ligada no RA Connect (DJEN, DataJud, normas.leg.br, Câmara, Senado, STJ, TST, TCU, CARF). Para chegar ao nível dos concorrentes faltam **cinco contratações**:

| # | Serviço | Para quê | Prioridade |
|---|---|---|---|
| 1 | **Judit** *ou* **Escavador** (API) | Busca por CPF/OAB e monitoramento de andamentos com aviso automático | Alta |
| 2 | **WhatsApp Business Platform** (Cloud API da Meta, direto ou via um BSP) | Receber as mensagens na Central do WhatsApp e responder pelo sistema | Alta |
| 3 | **Supabase Pro** + **Vercel Pro** | Banco com login e backup diário; hospedagem com uso comercial liberado e funções de até 5 min | Alta |
| 4 | **Caixa de e-mail com recebimento automático** (Postmark Inbound, SendGrid Inbound Parse ou Cloudflare Email Routing) | Ler os e-mails do Meu INSS (exigências, decisões) e transformar em prazo | Média |
| 5 | **API do Claude (Anthropic)** | Classificar mensagens e intimações com mais precisão, resumir publicações, sugerir prazo e minutas | Média |

Opcionais: assinatura eletrônica (ZapSign, Clicksign ou D4Sign), cobrança por boleto/PIX (Asaas, Banco Inter ou Mercado Pago) e transcrição de áudios do WhatsApp.

---

## 1. O que cada concorrente entrega e de onde vem o dado

| Dado | Quem tem | De onde vem | Como o RA Connect obtém |
|---|---|---|---|
| **Intimações / publicações** | ADVBox, Astrea, Legis, Tramitação | Diários oficiais. Desde a Resolução CNJ 455/2022 o **DJEN** é o meio oficial de intimação nos tribunais integrados | **DJEN (CNJ), gratuito, já integrado** (busca por OAB/MA 14.427 e OAB/PA 30.733). Diários que ainda não publicam no DJEN: cobertos pelo serviço do item 1 |
| **Andamentos processuais** | Astrea, Legis, Tramitação | Robôs que leem PJe, eproc, Projudi etc., ou bases agregadas | **DataJud, gratuito, já integrado**, mas atualiza com dias de atraso e não avisa sozinho. Para aviso automático: **Judit ou Escavador** (item 1) |
| **Processos por CPF / OAB** | Astrea, Legis (via parceiros) | Bases agregadas privadas. O DataJud **não** busca por CPF | **Item 1** (Judit, Escavador, Vigilant ou Jusneural; a rota já está pronta, falta a chave) |
| **Dados do INSS** (requerimentos, exigências, decisões) | Tramitação Inteligente | Não existe API pública do Meu INSS. A Tramitação usa e-mails de notificação recebidos (tem um módulo de *inbound e-mails*) e leitura do CNIS | **Item 4** (e-mail com recebimento automático) + leitor de CNIS em PDF (desenvolvimento próprio) |
| **Indicadores do CNIS / análise previdenciária** | Tramitação Inteligente | Leitura do PDF do CNIS enviado pelo cliente | Desenvolvimento próprio (extração do PDF) + **item 5** para resumir |
| **WhatsApp integrado** | ADVBox, Astrea (parcial) | WhatsApp Business Platform | **Item 2** |
| **Assinatura de contratos** | Astrea, Tramitação | ZapSign, Clicksign, D4Sign | Opcional |
| **Jurisprudência** | Todos | Portais dos tribunais | **Gratuito, já integrado** (TST, TCU, CARF, STJ); Jusbrasil API é opcional e paga |
| **Legislação** | Legis, Astrea | Planalto / LexML | **normas.leg.br, gratuito, já integrado** ("Ver texto da lei") |

---

## 2. Detalhes de cada contratação

### 2.1 Judit ou Escavador (escolher um)
- **Por quê:** é o que falta para "Decisões por CPF" e para receber aviso quando o processo anda, sem esperar o DataJud.
- **Judit:** consulta assíncrona por CPF, CNPJ, OAB ou número; tem monitoramento. Cobrança por consulta e por processo monitorado.
- **Escavador API v2:** busca por CPF/CNPJ (`/envolvido/processos`), monitoramento de processos e de diários. Cobrança por crédito.
- **O que pedir na negociação:** preço por consulta de CPF, preço por processo monitorado/mês, cobertura de TRF1, TJMA, TJPA e TRT8/TRT16, e se o aviso chega por *webhook*.
- **No RA Connect:** preencher `JUDIT_API_KEY` ou `ESCAVADOR_TOKEN` e `CPF_CONSULTA_HABILITADA=1` na Vercel.

### 2.2 WhatsApp Business Platform
- **Oficial (recomendado):** Cloud API da Meta, direto pelo Meta Business ou por um parceiro (BSP) como 360dialog, Twilio ou Gupshup. Cobra por conversa/mensagem de modelo; responder ao cliente dentro de 24 h é a parte mais barata.
- **Não oficiais (Z-API, Evolution API):** mais baratos, mas usam o WhatsApp Web e podem ter o número **banido**. Não recomendo para o número principal do escritório.
- **Requisitos:** CNPJ, Meta Business verificado, número dedicado (pode migrar o atual, mas ele sai do app comum).
- **No RA Connect:** falta criar a rota `/api/whatsapp/webhook` que recebe as mensagens; a classificação, a resposta pronta e os alarmes já estão prontos.

### 2.3 Supabase Pro e Vercel Pro
- **Supabase:** vocês já usam no gestao-escritorio. O plano Pro dá backup diário e não pausa o projeto. Região São Paulo (LGPD). O esquema está em `supabase/schema.sql`.
- **Vercel:** o plano gratuito (Hobby) **proíbe uso comercial** e limita funções a 60 s. O Pro libera os dois (a consulta do Jusneural pode levar até 120 s).

### 2.4 E-mail com recebimento automático (INSS)
- Criar um endereço como `inss@seudominio.com.br`, cadastrar como e-mail de contato nos requerimentos do Meu INSS, e mandar cada e-mail recebido para o RA Connect.
- Opções: Cloudflare Email Routing + Worker (praticamente gratuito), Postmark Inbound ou SendGrid Inbound Parse.
- O RA Connect lê o e-mail, identifica NB/protocolo e cria a exigência com prazo de 30 dias corridos (IN 212/2026).

### 2.5 API do Claude
- Melhora o que hoje é feito por regras: classificar mensagens com linguagem informal, ler o texto da intimação e sugerir o prazo, resumir CNIS, gerar rascunho de resposta.
- Cobrança por uso (tokens). Dados de clientes: usar sem retenção e registrar a base legal (LGPD).

---

## 3. O que **não** dá para contratar
- **API do Meu INSS / INSS Digital:** não existe para escritórios. Robôs que entram com login gov.br esbarram em captcha, verificação em duas etapas e nos termos de uso — risco jurídico e de bloqueio. Por isso a recomendação é o e-mail (item 4).
- **Codilo:** só libera a documentação depois do contrato; dá para avaliar como alternativa ao item 1.

## 4. Ordem sugerida
1. Supabase Pro + Vercel Pro (base para todo o resto).
2. Judit ou Escavador (CPF + monitoramento).
3. WhatsApp Business Platform.
4. E-mail do INSS.
5. API do Claude.
