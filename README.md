# Spartacus

Software jurídico **SaaS e white label** para escritórios de advocacia. Cada escritório tem o próprio endereço (`escritorio.spartacus.adv.br` ou domínio próprio), logo e cores, e os dados ficam isolados no banco. Feito a partir do RA Connect, sem nenhum dado de cliente dele.

Cores do produto: azul `#0131CD`, branco `#FFFFFF` e verde-limão `#B9FC01`.

- Colocar a plataforma no ar: [docs/PASSO-A-PASSO.md](docs/PASSO-A-PASSO.md)
- Implantar um escritório (até 3h): [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md)
- Serviços pagos opcionais: [docs/SERVICOS-A-CONTRATAR.md](docs/SERVICOS-A-CONTRATAR.md)

## Como funciona

| Parte | O que faz |
|---|---|
| **Plataforma** (`/plataforma`) | Equipe Spartacus cria escritórios, acompanha a implantação (9 passos, cronômetro contra a meta de 3h, tempo médio), define plano, situação (implantação, ativo, suspenso, cancelado), domínios próprios, módulos ligados e WhatsApp de cada um |
| **Multi-escritório** | Toda tabela tem `escritorio_id`; as regras do banco (RLS) só deixam cada pessoa ler e gravar o próprio escritório. Escritório suspenso perde o acesso na hora. Testado em Postgres real com `npm run test:banco` |
| **White label** | Nome, nome curto, logo e duas cores por escritório. As cores viram o tema inteiro (claro e escuro), com contraste corrigido automaticamente. Login, página inicial, documentos (cabeçalho, marca d'água) e resumo do WhatsApp saem com a marca do escritório |
| **Acesso** | O administrador libera e-mails em Configurações; a pessoa cria a senha em "Primeiro acesso" no endereço do escritório. Login de um escritório não entra no endereço de outro |
| **Área de trabalho** | Barra do topo com busca global (cliente, CPF, nº do processo; atalho `/`) e botão **Novo**; indicadores do dia; **Meu dia / Equipe** (atrasados, hoje, próximos 7 dias: prazos, atividades, audiências); publicações novas; clientes recentes; ferramentas em cartões |
| **Monitor** | DJEN (7h e 13h) e DataJud (6h, 12h e 18h) rodam para todos os escritórios ativos, cada um com as próprias OABs, avisos e WhatsApp |

Módulos herdados do RA Connect: Clientes e dossiê, Processos (DataJud, fases, resumo por IA), Publicações (DJEN), Prazos e agenda, Atividades (quadro), Documentos (procuração, contrato, declarações), WhatsApp, E-mails dos clientes, Painel, Produção, Financeiro, Normas (234 mil normas federais), Decisões por CPF, Ferramentas de PDF, Ditado, CRM, Diretório de senhas.

## Rodar no computador

```bash
npm install
npm run dev          # http://localhost:5173 — sem Supabase abre em modo de testes, com dados de exemplo
npm test             # regras (prazos, CPF, CNJ, marca, implantação, busca…)
npm run test:banco   # schema.sql num Postgres em memória: isolamento entre escritórios
```

Com Supabase local ou de testes, use `?escritorio=slug` na URL para abrir a marca de um escritório sem DNS.

## Estrutura

```
supabase/schema.sql          banco multi-escritório, regras de acesso e funções da plataforma
scripts/testar-banco.mjs     teste de isolamento (PGlite)
src/marca.ts                 white label: cores, contraste, marca do endereço
src/nuvem.ts                 Supabase: login, carga e gravação por escritório, tempo real, plataforma
src/menu.ts                  menu em seções = módulos que a plataforma liga/desliga
src/pages/Plataforma.tsx     console da plataforma
src/pages/AreaTrabalho.tsx   área de trabalho
src/lib/implantacao.ts       roteiro de implantação (meta 3h)
server/monitor/              DJEN + DataJud por escritório
server/servidor.ts           servidor próprio; /interno/dominio-permitido para o HTTPS sob demanda
infra/spartacus/             docker compose, Caddy (HTTPS por subdomínio e domínio próprio), publicar.sh
```

## Limitações conhecidas

- Feriados estaduais embutidos só de MA e PA; os demais estados entram como feriados cadastrados na implantação.
- Cada login pertence a um escritório só.
- O app carrega todos os dados do escritório no navegador (como no RA Connect): ótimo até alguns milhares de processos por escritório; acima disso, paginar no servidor.
- Os textos dos modelos de procuração e contrato são os do previdenciário; escritórios de outras áreas precisam de modelos próprios.
