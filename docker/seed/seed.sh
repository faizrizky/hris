#!/usr/bin/env bash
# Seed ulang data uji HRIS ke instance ERPNext yang sedang berjalan. Idempotent.
# Pakai (dari folder docker/):  ./seed/seed.sh             (site default SITE_NAME)
#                               ./seed/seed.sh klien-a.localhost
#                               ./seed/seed.sh --semua    (semua site company; Server Script ikut tersebar)
# Password dan API key dibaca/ditulis di docker/.credentials.local (di-ignore git).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
CRED=.credentials.local
[ -f .env ] && { set -a; . ./.env; set +a; }
DEFAULT_SITE="${SITE_NAME:-hris.localhost}"
if [ "${1:-}" = "--semua" ]; then
  # Registry bukan site company (tidak punya erpnext/hrms), jadi dilewati.
  for s in $(docker compose exec -T backend sh -c 'cd sites && for d in */; do [ -f "$d/site_config.json" ] && echo "${d%/}"; done'); do
    [ "$s" = "${REGISTRY_SITE:-admin.localhost}" ] && continue
    echo "===== $s"; "$0" "$s"
  done
  exit 0
fi
SITE="${1:-$DEFAULT_SITE}"
touch "$CRED"; chmod 600 "$CRED"
# Nilai bawaan dev (hanya ditulis bila belum ada).
for kv in BASE_URL=http://localhost:${HTTP_PUBLISH_PORT:-8082} USER_EMAIL=rani.test@example.com USER_PASSWORD=dev \
          MSS_USER_EMAIL=mss.test@example.com MSS_USER_PASSWORD=dev HR_USER_EMAIL=hr.test@example.com HR_USER_PASSWORD=dev \
          ARMAN_USER_EMAIL=arman.test@example.com ARMAN_USER_PASSWORD=dev; do
  grep -q "^${kv%%=*}=" "$CRED" || echo "$kv" >> "$CRED"
done
set -a; . "./$CRED"; set +a
regen=0
grep -q '^API_SECRET=.\+' "$CRED" || regen=1

docker compose exec -T backend bench set-config -g server_script_enabled 1
docker compose exec -T -u root backend rm -rf /tmp/hris-seed
docker compose exec -T -u root backend mkdir -p -m 777 /tmp/hris-seed
docker compose cp seed/seed.py backend:/tmp/hris-seed/seed.py
docker compose cp server-scripts backend:/tmp/hris-seed/server-scripts
# Override per klien: clients/<site>/server-scripts/ menimpa skrip utama yang namanya sama (dan boleh menambah
# skrip khusus klien). Skrip utama di server-scripts/ tidak pernah diubah; hanya salinan sementara untuk site ini.
if [ -d "clients/$SITE/server-scripts" ]; then
  docker compose cp "clients/$SITE/server-scripts/." backend:/tmp/hris-seed/server-scripts/
  echo "[seed] override klien $SITE: $(ls "clients/$SITE/server-scripts" | tr '\n' ' ')"
fi
docker compose exec -T -u root backend chmod -R a+rX /tmp/hris-seed
out=$(docker compose exec -T -w /home/frappe/frappe-bench/sites \
  -e SITE_NAME="$SITE" -e SEED_PAKET -e USER_EMAIL -e USER_PASSWORD -e MSS_USER_EMAIL -e MSS_USER_PASSWORD \
  -e HR_USER_EMAIL -e HR_USER_PASSWORD -e ARMAN_USER_EMAIL -e ARMAN_USER_PASSWORD -e SEED_REGEN_KEYS="$regen" \
  backend ../env/bin/python /tmp/hris-seed/seed.py 2>&1 | grep -v RuntimeWarning; exit ${PIPESTATUS[0]}) && rc=0 || rc=$?
# Server Script baru baru terbaca setelah cache dibersihkan.
docker compose exec -T backend bench --site "$SITE" clear-cache >/dev/null 2>&1
# Cetak log tanpa baris rahasia; simpan API key/secret ke .credentials.local (hanya milik site default,
# supaya site company lain tidak menimpa kunci yang dipakai smoke.sh).
echo "$out" | grep -v '^SEED_API_' || true
[ "$SITE" = "$DEFAULT_SITE" ] || exit ${rc:-0}
for k in API_KEY API_SECRET; do
  v=$(echo "$out" | sed -n "s/^SEED_$k=//p" || true)
  if [ -n "$v" ]; then
    grep -v "^$k=" "$CRED" > "$CRED.tmp" || true
    echo "$k=$v" >> "$CRED.tmp"; mv "$CRED.tmp" "$CRED"; chmod 600 "$CRED"
    echo "[seed] $k baru ditulis ke $CRED"
  fi
done
exit ${rc:-0}
