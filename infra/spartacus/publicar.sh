#!/usr/bin/env bash
# Publica a versão atual (último commit) na VPS: envia o código por SSH e reconstrói só o app.
# Uso (no computador, dentro do repositório):  VPS=root@IP bash infra/spartacus/publicar.sh
# Chave SSH: ~/.ssh/spartacus_vps (ou defina CHAVE=caminho).
set -euo pipefail
: "${VPS:?defina VPS, ex.: VPS=root@123.45.67.89}"
CHAVE="${CHAVE:-$HOME/.ssh/spartacus_vps}"
SSH=(ssh -i "$CHAVE" -o StrictHostKeyChecking=accept-new "$VPS")
cd "$(git rev-parse --show-toplevel)"
[ -z "$(git status --porcelain)" ] || echo "Aviso: há alterações não commitadas; vai só o último commit."

echo "== Enviando $(git log --oneline -1)"
git archive --format=tar HEAD | "${SSH[@]}" 'mkdir -p /opt/spartacus && tar -x -C /opt/spartacus'

echo "== Reconstruindo o Spartacus"
"${SSH[@]}" 'cd /opt/spartacus/infra/spartacus && docker compose build spartacus && docker compose up -d && docker image prune -f >/dev/null'
echo "Pronto."
