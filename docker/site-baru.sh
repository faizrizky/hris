#!/usr/bin/env bash
# Buat site company klien baru di bench yang sama (multi-site), lalu isi lewat seed.
# Pakai (dari folder docker/):  ./site-baru.sh klien-a.localhost [password-admin]
# Mendaftarkan kodenya ke registry tetap langkah terpisah: ./seed/registry.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[ -f .env ] && { set -a; . ./.env; set +a; }
SITE="${1:?Pakai: ./site-baru.sh <nama-site> [password-admin]}"
PASS="${2:-${ADMIN_PASSWORD:-admin}}"
[[ "$SITE" =~ ^[a-z0-9-]+(\.[a-z0-9-]+)+$ ]] || { echo "Nama site harus berbentuk host, mis. klien-a.localhost"; exit 1; }

if docker compose exec -T backend test -d "sites/$SITE"; then
  echo "Site $SITE sudah ada, pembuatan dilewati."
else
  docker compose exec -T backend bench new-site "$SITE" \
    --mariadb-user-host-login-scope='%' \
    --db-root-username=root --db-root-password="${DB_ROOT_PASSWORD:-admin}" \
    --admin-password="$PASS" \
    --install-app erpnext --install-app hrms --install-app sentra_ats
fi
./seed/seed.sh "$SITE"
