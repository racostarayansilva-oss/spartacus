#!/usr/bin/env bash
# Publica a versão atual (último commit) na VPS: envia o código por SSH e reconstrói só o RA Connect.
# Uso (no computador, dentro do repositório):  VPS=root@IP bash infra/publicar.sh
# A chave SSH usada é ~/.ssh/ra_connect_vps (cadastrada no hPanel da Hostinger).
set -euo pipefail
: "${VPS:?defina VPS, ex.: VPS=root@123.45.67.89}"
CHAVE="${CHAVE:-$HOME/.ssh/ra_connect_vps}"
SSH=(ssh -i "$CHAVE" -o StrictHostKeyChecking=accept-new "$VPS")
cd "$(git rev-parse --show-toplevel)"
[ -z "$(git status --porcelain)" ] || echo "Aviso: há alterações não commitadas; vai só o último commit."

echo "== Enviando $(git log --oneline -1)"
git archive --format=tar HEAD | "${SSH[@]}" 'mkdir -p /opt/ra-connect && tar -x -C /opt/ra-connect'

echo "== Reconstruindo o RA Connect"
"${SSH[@]}" 'cd /opt/ra-connect/infra/crm && docker compose build ra-connect && docker compose up -d ra-connect caddy && docker image prune -f >/dev/null'
echo "Pronto."
