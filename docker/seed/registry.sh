#!/usr/bin/env bash
# Buat/perbarui site registry tenant (kode company -> site klien). Idempotent.
# Pakai (dari folder docker/):  ./seed/registry.sh
# Tenant baru ditambah di Desk registry: http://admin.localhost:8082/app/hris-tenant
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
REG="${REGISTRY_SITE:-admin.localhost}"

if ! docker compose exec -T backend test -d "sites/$REG"; then
  # Registry hanya butuh frappe: tidak ada data HR di sini.
  docker compose exec -T backend bench new-site "$REG" \
    --mariadb-user-host-login-scope='%' \
    --db-root-username=root --db-root-password="${DB_ROOT_PASSWORD:-admin}" \
    --admin-password="${ADMIN_PASSWORD:-admin}"
fi
docker compose exec -T -u root backend rm -rf /tmp/hris-registry
docker compose exec -T -u root backend mkdir -p -m 777 /tmp/hris-registry
docker compose cp seed/registry.py backend:/tmp/hris-registry/registry.py
docker compose cp seed/server-scripts backend:/tmp/hris-registry/server-scripts
docker compose exec -T -u root backend chmod -R a+rX /tmp/hris-registry
docker compose exec -T -w /home/frappe/frappe-bench/sites -e REGISTRY_SITE="$REG" \
  backend ../env/bin/python /tmp/hris-registry/registry.py 2>&1 | grep -v RuntimeWarning
