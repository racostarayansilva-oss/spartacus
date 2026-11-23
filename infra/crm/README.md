# Servidor do CRM (Evo CRM Community)

Uma VPS só, com Docker Compose. O RA Connect continua na Vercel + Supabase. A rota `/crm` dele abre este CRM em iframe, já logado.

## Servidor
- **VPS Ubuntu 24.04, 4 vCPU, 16 GB RAM, 200 GB NVMe** (ex.: Hostinger KVM 4; prefira datacenter no Brasil se o checkout oferecer).
- Os serviços somam cerca de 12 GB de limite de memória; os outros 4 GB ficam para o sistema e para picos.

## Passo a passo
1. **DNS:** crie dois registros tipo A apontando para o IP da VPS: `crm.SEUDOMINIO` e `api-crm.SEUDOMINIO`.
2. **Na VPS, como root:**
   ```bash
   git clone https://github.com/racostarayansilva-oss/ra-connect.git /opt/ra-connect
   cd /opt/ra-connect/infra/crm
   DOMINIO_CRM=crm.SEUDOMINIO DOMINIO_API=api-crm.SEUDOMINIO EMAIL_SSL=seu@email bash instalar.sh
   ```
   O script instala o Docker, configura o firewall e o swap, gera todos os segredos em `.env`, sobe os serviços e agenda um backup diário do banco (às 03h, guardando 14 dias) em `/opt/evo-crm-backups`.
3. **CRM:** abra `https://crm.SEUDOMINIO`, crie a conta de administrador e cadastre cada pessoa da equipe **com o mesmo e-mail do login do RA Connect**.
4. **Vercel → Settings → Environment Variables:** cadastre `CRM_URL`, `CRM_API_URL` e `CRM_SSO_TOKEN` (os valores aparecem no fim do `instalar.sh`) e faça um novo deploy.
5. **Teste:** no RA Connect, abra o menu **CRM**. A pessoa deve entrar direto, sem tela de login.

## Comandos do dia a dia
- Ver o estado dos serviços: `docker compose ps`
- Acompanhar o log de um serviço: `docker compose logs -f evo-crm`
- Atualizar a versão: troque `EVO_VERSION` no `.env` e rode `docker compose build --pull && docker compose up -d`. Teste sempre antes de atualizar.
- Restaurar um backup: `gunzip -c ARQUIVO.sql.gz | docker compose exec -T pgvector psql -U postgres`
