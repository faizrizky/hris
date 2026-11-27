#!/usr/bin/env bash
# ===========================================================================
# Menaikkan stack ke image sentra_ats yang sudah dibangun, lalu migrate semua site. Dijalankan DI SERVER.
#
#   ./release.sh <tag>        mis. 16-ats-1a2b3c4 (hasil build-ats-image.sh)
#   ./release.sh --rollback   kembali ke tag dan mode sebelumnya
#
# Urutan: backup tiap site -> ganti image -> migrate tiap site (kecuali registry) -> restart -> uji cepat.
# Bila ada langkah yang gagal, stack otomatis dikembalikan ke image sebelumnya. Database TIDAK dipulihkan
# otomatis (itu destruktif); lokasi backup dicetak supaya bisa dipulihkan dengan `bench restore` bila perlu.
# ===========================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[ -f .env ] && { set -a; . ./.env; set +a; }

STATE=.release-state
REGISTRY_SITE="${REGISTRY_SITE:-admin.localhost}"
OVERLAY=(-f docker-compose.yml -f docker-compose.dev.yml)
PLAIN=(-f docker-compose.yml)

# Hanya image -ats- yang memuat sentra_ats; image dasar tanpa itu tidak bisa dijalankan sebagai target pemulihan.
restorable() { [[ "$1" == *-ats-* ]]; }

state() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -1 || true; }
set_tag() {  # tulis CUSTOM_TAG ke .env supaya restart berikutnya memakai tag yang sama
  { grep -v '^CUSTOM_TAG=' .env 2>/dev/null || true; echo "CUSTOM_TAG=$1"; } > .env.tmp && mv .env.tmp .env
}
up() {       # up <tag> <overlay 0|1>
  set_tag "$1"
  if [ "$2" = 1 ]; then CUSTOM_TAG="$1" docker compose "${OVERLAY[@]}" up -d; else CUSTOM_TAG="$1" docker compose "${PLAIN[@]}" up -d; fi
}
dc() { if [ "${ACTIVE_OVERLAY:-0}" = 1 ]; then docker compose "${OVERLAY[@]}" "$@"; else docker compose "${PLAIN[@]}" "$@"; fi; }
wait_backend() { for _ in $(seq 1 40); do dc exec -T backend bench version >/dev/null 2>&1 && return 0; sleep 3; done; return 1; }
sites() { dc exec -T backend bash -c 'cd sites && for d in */; do [ -f "$d/site_config.json" ] && echo "${d%/}"; done'; }
# Ganti nama app hris_ats -> sentra_ats di database tiap site (rename_app.py); --reverse untuk rollback.
rename_app() {
  local s
  for s in $(sites); do
    [ "$s" = "$REGISTRY_SITE" ] && continue
    dc exec -T -w /home/frappe/frappe-bench/sites backend ../env/bin/python - "$s" "$@" < rename_app.py | grep -E "^(RENAMED|SKIP)" || return 1
  done
  dc exec -T redis-cache redis-cli flushall >/dev/null   # daftar app terpasang tersimpan di cache
}

if [ "${1:-}" = "--rollback" ]; then
  PREV_TAG="$(state prev_tag)"; PREV_OVERLAY="$(state prev_overlay)"
  [ -n "$PREV_TAG" ] || { echo "Tidak ada rilis sebelumnya yang tercatat."; exit 1; }
  restorable "$PREV_TAG" || { echo "Rilis sebelumnya ($PREV_TAG) bukan image sentra_ats sehingga tidak bisa dipulihkan. Bangun image lama dengan ./build-ats-image.sh <akhiran> lalu ./release.sh <tag>."; exit 1; }
  echo "==> Kembali ke $PREV_TAG (overlay dev: $PREV_OVERLAY)"
  if [ "$(state renamed)" = 1 ]; then echo "==> Mengembalikan nama app lama di database"; rename_app --reverse; fi
  up "$PREV_TAG" "$PREV_OVERLAY"
  printf 'tag=%s\noverlay=%s\n' "$PREV_TAG" "$PREV_OVERLAY" > "$STATE"
  exit 0
fi

TAG="${1:?Pemakaian: ./release.sh <tag> | --rollback}"
IMAGE="${CUSTOM_IMAGE:-hris-erpnext}"
docker image inspect "$IMAGE:$TAG" >/dev/null 2>&1 || { echo "ERROR: image $IMAGE:$TAG tidak ada."; exit 1; }

PREV_TAG="${CUSTOM_TAG:-16}"
PREV_OVERLAY="$(state overlay)"; PREV_OVERLAY="${PREV_OVERLAY:-1}"   # tanpa catatan: anggap masih mode dev bawaan lama
ACTIVE_OVERLAY="$PREV_OVERLAY"

echo "==> Backup semua site sebelum rilis"
BACKUPS=()
for s in $(sites); do
  [ "$s" = "$REGISTRY_SITE" ] && continue
  out="$(dc exec -T backend bench --site "$s" backup 2>&1 | grep -E "Database:" || true)"
  BACKUPS+=("$s: ${out:-backup tidak dilaporkan}")
done
printf '   %s\n' "${BACKUPS[@]}"

RENAMED=0
rollback_on_error() {
  [ "$RENAMED" = 1 ] && { echo "!! Mengembalikan nama app lama di database." >&2; rename_app --reverse >&2 || true; }
  if restorable "$PREV_TAG"; then
    echo "!! Rilis gagal. Mengembalikan stack ke $PREV_TAG." >&2
    up "$PREV_TAG" "$PREV_OVERLAY" || true   # catatan status tidak diubah: stack kembali ke keadaan yang sudah tercatat
  else
    echo "!! Rilis gagal, dan $PREV_TAG bukan image sentra_ats sehingga stack tidak dikembalikan otomatis." >&2
  fi
  echo "!! Database tidak dipulihkan otomatis. Backup sebelum rilis:" >&2
  printf '   %s\n' "${BACKUPS[@]}" >&2
}
trap rollback_on_error ERR

echo "==> Mengganti image ke $IMAGE:$TAG (tanpa mount dev)"
up "$TAG" 0
ACTIVE_OVERLAY=0
wait_backend

echo "==> Penyesuaian nama app di database (sekali saja)"
renames="$(rename_app)"
printf '   %s\n' "$renames"
if grep -q "^RENAMED" <<<"$renames"; then RENAMED=1; fi

echo "==> Migrate semua site"
for s in $(sites); do
  [ "$s" = "$REGISTRY_SITE" ] && continue
  echo "-- $s"
  dc exec -T backend bench --site "$s" migrate 2>&1 | tail -2
  dc exec -T backend bench --site "$s" clear-cache >/dev/null 2>&1
done

echo "==> Memuat ulang layanan"
dc restart backend queue-short queue-long queue-browser scheduler websocket >/dev/null 2>&1
dc restart frontend >/dev/null 2>&1   # nginx menyimpan IP backend saat start
wait_backend
sleep 10

echo "==> Uji cepat"
PORT="$(dc port frontend 8080 | sed 's/.*://')"
for s in $(sites); do
  [ "$s" = "$REGISTRY_SITE" ] && continue
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $s" -H "X-Frappe-Site-Name: $s" "http://127.0.0.1:$PORT/api/method/ping")"
  echo "   $s -> $code"
  case "$code" in 200|402) ;; *) echo "Site $s tidak sehat ($code)" >&2; false;; esac   # 402 = langganan nonaktif, memang terkunci
done

trap - ERR
printf 'tag=%s\noverlay=0\nprev_tag=%s\nprev_overlay=%s\nrenamed=%s\n' "$TAG" "$PREV_TAG" "$PREV_OVERLAY" "$RENAMED" > "$STATE"
echo "==> Rilis $TAG selesai. Kembalikan dengan ./release.sh --rollback"
