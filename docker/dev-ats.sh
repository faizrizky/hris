#!/usr/bin/env bash
# ===========================================================================
# Pasang / perbarui custom app hris_ats di stack ERPNext dev.
# Aman dijalankan berulang kali (idempotent).
#
# Penggunaan:
#   cd docker
#   ./dev-ats.sh
# ===========================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f .env ] && { set -a; . ./.env; set +a; }
SITE_NAME="${SITE_NAME:-hris.localhost}"

# 1. Pastikan container dev sudah berjalan dengan volume mount hris_ats
echo "[dev-ats] Memastikan stack container dev berjalan..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Pasang hris_ats dalam mode editable di virtualenv setiap service Python
PYTHON_SERVICES=("backend" "queue-short" "queue-long" "scheduler")
for svc in "${PYTHON_SERVICES[@]}"; do
  echo "[dev-ats] Memasang hris_ats di virtualenv service $svc..."
  docker compose exec -T "$svc" env/bin/pip install -q -e apps/hris_ats
done

# 3. Pastikan hris_ats tercantum di sites/apps.txt
echo "[dev-ats] Memastikan hris_ats ada di sites/apps.txt..."
docker compose exec -T backend bash -c '
  if ! grep -Fxq "hris_ats" sites/apps.txt 2>/dev/null; then
    echo "hris_ats" >> sites/apps.txt
    sort -u -o sites/apps.txt sites/apps.txt
  fi
'

# 4. Pasang app di site bila belum terpasang, atau migrate bila sudah
echo "[dev-ats] Memeriksa status hris_ats di site $SITE_NAME..."
if docker compose exec -T backend bench --site "$SITE_NAME" list-apps | grep -qw "hris_ats"; then
  echo "[dev-ats] hris_ats sudah terpasang di site. Menjalankan bench migrate..."
  docker compose exec -T backend bench --site "$SITE_NAME" migrate
else
  echo "[dev-ats] hris_ats belum terpasang. Menjalankan install-app..."
  docker compose exec -T backend bench --site "$SITE_NAME" install-app hris_ats
fi

# 5. Bangun aset frontend hris_ats
echo "[dev-ats] Membangun aset hris_ats..."
docker compose exec -T backend bench build --app hris_ats

# 6. Bersihkan cache site
echo "[dev-ats] Membersihkan cache site..."
docker compose exec -T backend bench --site "$SITE_NAME" clear-cache

# 7. Restart service aplikasi Python agar modul baru dimuat ulang
echo "[dev-ats] Memuat ulang service backend dan worker..."
docker compose restart backend queue-short queue-long scheduler >/dev/null 2>&1 || true

echo "[dev-ats] Selesai! hris_ats siap digunakan."
