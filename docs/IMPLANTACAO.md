# Roteiro de implantação de um escritório (até 3 horas)

Para quem faz a implantação na equipe Spartacus. O mesmo roteiro aparece na **Plataforma → escritório → Implantação**, com caixinhas, cronômetro e o tempo previsto de cada passo. Marque cada passo ao terminar: a plataforma mede o tempo real de cada implantação e mostra a média.

| # | Passo | Tempo | Onde |
|---|---|---|---|
| 1 | Cadastro, endereço e administrador | 10 min | Plataforma → Novo escritório |
| 2 | Marca: logo, nome e cores | 15 min | Plataforma → escritório → Marca |
| 3 | Domínio próprio (opcional) | 15 min | Plataforma → escritório → Domínio próprio |
| 4 | Equipe e papéis | 20 min | App do escritório → Configurações → Equipe e acessos |
| 5 | OABs, feriados e calendário | 15 min | Configurações e Prazos e agenda |
| 6 | Importar processos e clientes | 50 min | Processos → Importar |
| 7 | Modelos de documentos | 25 min | Configurações → Dados nos documentos; Documentos |
| 8 | WhatsApp e e-mails dos clientes | 15 min | Plataforma (WhatsApp) e Configurações (e-mails) |
| 9 | Treinamento e entrega | 15 min | Área de trabalho, com o escritório |
| | **Total** | **3h00** | |

## Antes de começar (pedir ao escritório)

- Logo em PNG ou SVG, de preferência quadrado e com fundo transparente.
- Cores da marca (código, ex.: `#0131CD`), se tiverem.
- Nome completo do escritório e um nome curto para a barra lateral.
- Números de OAB com UF de todos os advogados (as intimações do DJEN são buscadas por eles).
- E-mails e papéis da equipe.
- Relatório de processos do sistema anterior (CSV do Legis, planilha) ou só as OABs.
- Qualificação do advogado para procuração e contrato, telefone/e-mail do cabeçalho e comarca do foro.
- Se quiserem domínio próprio: acesso ao DNS do domínio.

## 1. Cadastro (10 min)

Plataforma → **Novo escritório**: nome, endereço (o subdomínio é sugerido pelo nome), plano, OABs (`123456/SP, 7890/MA`) e e-mail do administrador. Ao criar:

- o escritório fica em `slug.DOMINIO_PLATAFORMA` (ex.: `silva.spartacus.adv.br`);
- o e-mail do administrador já está liberado: ele entra pelo endereço do escritório em **Primeiro acesso? Criar senha**.

## 2. Marca (15 min)

Na ficha do escritório, envie o logo e ajuste as cores. A prévia mostra a barra lateral e os botões. Se a cor escolhida deixar o texto ilegível, o sistema escurece ou clareia só o necessário e avisa. O administrador do escritório pode mudar a marca depois em Configurações.

## 3. Domínio próprio (15 min, opcional)

No DNS do escritório, crie `CNAME sistema → DOMINIO_PLATAFORMA` (ou o host que preferirem). Cadastre o domínio na ficha. O HTTPS é emitido sozinho no primeiro acesso (o servidor só emite para domínios cadastrados). Um domínio só pode pertencer a um escritório.

## 4. Equipe (20 min)

Entre no app do escritório como administrador (ou peça ao administrador) e, em **Configurações → Equipe e acessos**, libere cada e-mail com o papel. Envie o endereço do escritório; cada pessoa cria a senha em **Primeiro acesso**.

## 5. OABs e feriados (15 min)

- Confira as OABs em Configurações (o DJEN é consultado às 7h e às 13h).
- Os estados das OABs definem os feriados estaduais no cálculo de prazos. **Só MA e PA vêm embutidos**: para os demais estados, cadastre os feriados estaduais e os municipais das comarcas em Prazos e agenda. Confira o calendário do tribunal do escritório.

## 6. Processos e clientes (50 min)

Escolha um caminho em Processos:

- **Pela OAB (DJEN)**: cria processos e clientes a partir das comunicações dos últimos meses. Gratuito.
- **Relatório do Legis (CSV)** ou planilha: traz números, valores da causa e fases.
- Depois: **Revisar fases** e atualizar pelo DataJud.

## 7. Documentos (25 min)

Configurações → **Dados nos documentos**: qualificação do advogado (entra como outorgado/contratado), contato do cabeçalho e foro do contrato. Gere uma procuração de teste e confira com o escritório.

## 8. WhatsApp e e-mails (15 min)

- WhatsApp: crie a instância do escritório na Evolution API e preencha instância e destino na ficha do escritório (o resumo diário de intimações vai para esse número/grupo).
- E-mails dos clientes: em Configurações, domínio dos e-mails e a chave do Cloudflare (passo a passo na própria tela).

## 9. Treinamento e entrega (15 min)

Mostre a Área de trabalho (Meu dia, publicações, busca global com `/`), o fluxo publicação → prazo → atividade e o botão **Novo**. Marque o último passo e clique em **Marcar escritório como ativo**.
