#!/usr/bin/env bash
# Instala o RA Connect e o Evo CRM numa VPS Ubuntu 24.04 limpa. Rode como root, dentro da pasta infra/crm:
#   DOMINIO_APP=x.com.br DOMINIO_CRM=crm.x.com.br DOMINIO_API=api-crm.x.com.br EMAIL_SSL=voce@x.com bash instalar.sh
# Antes, crie ra-connect.env a partir de ra-connect.env.example (chaves do Supabase).
set -euo pipefail
cd "$(dirname "$0")"

: "${DOMINIO_APP:?defina DOMINIO_APP}" "${DOMINIO_CRM:?defina DOMINIO_CRM}" "${DOMINIO_API:?defina DOMINIO_API}" "${EMAIL_SSL:?defina EMAIL_SSL}"

echo "== Sistema, firewall e swap"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl ufw unattended-upgrades openssl
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "== Segredos (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  hex() { openssl rand -hex "$1"; }
  set_env() { sed -i "s|^$1=.*|$1=$2|" .env; }
  set_env DOMINIO_APP "$DOMINIO_APP"
  set_env ORIGEM_RA_CONNECT "${ORIGEM_RA_CONNECT:-https://$DOMINIO_APP}"
  set_env DOMINIO_CRM "$DOMINIO_CRM"
  set_env DOMINIO_API "$DOMINIO_API"
  set_env EMAIL_SSL "$EMAIL_SSL"
  set_env POSTGRES_PASSWORD "$(hex 24)"
  set_env SECRET_KEY_BASE "$(hex 64)"
  set_env JWT_SECRET_KEY "$(hex 32)"
  set_env EVOAI_CRM_API_TOKEN "$(hex 32)"
  set_env DOORKEEPER_JWT_SECRET_KEY "$(hex 32)"
  set_env ENCRYPTION_KEY "$(openssl rand -base64 32 | tr '+/' '-_')"
  set_env BOT_RUNTIME_SECRET "$(hex 32)"
  set_env AUTH_APIKEY_INTEGRATION_LOCAL "$(hex 32)"
  set_env CLICKHOUSE_PASSWORD "$(hex 16)"
  set_env RABBITMQ_PASSWORD "$(hex 16)"
  set_env RA_CONNECT_SSO_TOKEN "$(hex 32)"
  set_env EVOLUTION_API_KEY "$(hex 32)"
  chmod 600 .env
fi

[ -f ra-connect.env ] || { echo "Falta ra-connect.env (copie de ra-connect.env.example e preencha o Supabase)"; exit 1; }

echo "== Subindo os serviços (a primeira vez demora alguns minutos)"
docker compose build --pull
docker compose up -d

echo "== Backup diário do banco (03h, guarda 14 dias)"
mkdir -p /opt/evo-crm-backups
cat > /etc/cron.d/evo-crm-backup <<CRON
0 3 * * * root cd $(pwd) && docker compose exec -T pgvector pg_dumpall -U postgres | gzip > /opt/evo-crm-backups/evocrm-\$(date +\%F).sql.gz && find /opt/evo-crm-backups -name '*.sql.gz' -mtime +14 -delete
CRON

echo
echo "Pronto. Acompanhe com: docker compose ps   e   docker compose logs -f evo-crm"
echo "RA Connect: https://$DOMINIO_APP"
echo "CRM: abra https://$DOMINIO_CRM para criar o administrador (CRM_URL, CRM_API_URL e CRM_SSO_TOKEN já vão para o RA Connect)."
echo "Se o RA Connect continuar também na Vercel, cadastre lá CRM_SSO_TOKEN=$(grep '^RA_CONNECT_SSO_TOKEN=' .env | cut -d= -f2)"
