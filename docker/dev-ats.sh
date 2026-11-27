#!/usr/bin/env bash
# ===========================================================================
# Pasang / perbarui custom app sentra_ats di stack ERPNext dev.
# Aman dijalankan berulang kali (idempotent).
#
# Penggunaan:
#   cd docker
#   ./dev-ats.sh [--with-browsers]
# ===========================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

WITH_BROWSERS=0
for arg in "$@"; do
  case "$arg" in
    --with-browsers)
      WITH_BROWSERS=1
      ;;
    *)
      echo "Opsi tidak dikenal: $arg" >&2
      exit 1
      ;;
  esac
done

[ -f .env ] && { set -a; . ./.env; set +a; }
SITE_NAME="${SITE_NAME:-hris.localhost}"

# 1. Pastikan container dev sudah berjalan dengan volume mount sentra_ats
echo "[dev-ats] Memastikan stack container dev berjalan..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Pasang sentra_ats dalam mode editable di virtualenv setiap service Python
PYTHON_SERVICES=("backend" "queue-short" "queue-long" "queue-browser" "scheduler")
for svc in "${PYTHON_SERVICES[@]}"; do
  echo "[dev-ats] Memasang sentra_ats di virtualenv service $svc..."
  docker compose exec -T "$svc" env/bin/pip install -q -e apps/sentra_ats
done

if [ "$WITH_BROWSERS" -eq 1 ]; then
  BROWSER_SERVICES=("backend" "queue-long" "queue-browser")
  for svc in "${BROWSER_SERVICES[@]}"; do
    echo "[dev-ats] Memasang dependensi sistem browser (root) di service $svc..."
    docker compose exec -T -u root "$svc" env/bin/python -m playwright install-deps chromium
    echo "[dev-ats] Memasang browser Chromium (user frappe) di service $svc..."
    docker compose exec -T "$svc" env/bin/python -m playwright install chromium
    docker compose exec -T "$svc" env/bin/python -c '
from scrapling.cli import __PACKAGE_DIR__
from tld.utils import update_tld_names
update_tld_names(fail_silently=True)
__PACKAGE_DIR__.joinpath(".scrapling_dependencies_installed").touch()
'
  done
fi
echo "[dev-ats] Memastikan dependensi pengujian (pytest) terpasang di service backend..."
docker compose exec -T backend env/bin/pip install -q pytest

# 3. Pastikan sentra_ats tercantum di sites/apps.txt
echo "[dev-ats] Memastikan sentra_ats ada di sites/apps.txt..."
docker compose exec -T backend bash -c '
  if ! grep -Fxq "sentra_ats" sites/apps.txt 2>/dev/null; then
    echo "sentra_ats" >> sites/apps.txt
  fi
'

# 4. Pasang app di site bila belum terpasang, atau migrate bila sudah
echo "[dev-ats] Memeriksa status sentra_ats di site $SITE_NAME..."
if docker compose exec -T backend bench --site "$SITE_NAME" list-apps | grep -qw "sentra_ats"; then
  echo "[dev-ats] sentra_ats sudah terpasang di site. Menjalankan bench migrate..."
  docker compose exec -T backend bench --site "$SITE_NAME" migrate
else
  echo "[dev-ats] sentra_ats belum terpasang. Menjalankan install-app..."
  docker compose exec -T backend bench --site "$SITE_NAME" install-app sentra_ats
fi

# 5. Bangun aset frontend sentra_ats
echo "[dev-ats] Membangun aset sentra_ats..."
docker compose exec -T backend bench build --app sentra_ats
docker compose exec -T -u root frontend ln -sfn /home/frappe/frappe-bench/apps/sentra_ats/sentra_ats/public /home/frappe/frappe-bench/assets/sentra_ats 2>/dev/null || true

# 6. Bersihkan cache site
echo "[dev-ats] Membersihkan cache site..."
docker compose exec -T backend bench --site "$SITE_NAME" clear-cache

# 7. Restart service aplikasi Python agar modul baru dimuat ulang
echo "[dev-ats] Memuat ulang service backend dan worker..."
docker compose restart backend queue-short queue-long queue-browser scheduler >/dev/null 2>&1 || true
# nginx menyimpan IP backend saat start; tanpa restart frontend, backend yang dapat IP baru memicu 502.
docker compose restart frontend >/dev/null 2>&1 || true

echo "[dev-ats] Selesai! sentra_ats siap digunakan."

