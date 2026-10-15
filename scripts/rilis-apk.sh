#!/usr/bin/env bash
# Menerbitkan build EAS sebagai pembaruan aplikasi. Aplikasi yang lebih lama otomatis memintanya saat dibuka
# (layar pembuka: "Memeriksa pembaruan…", unduh dengan progres, lalu pemasang Android).
#
# Pakai:  ./scripts/rilis-apk.sh <build-id> ["catatan rilis"]
#         ./scripts/rilis-apk.sh <build-id> "catatan" --eas     # tautan APK = artefak EAS (tanpa menaruh di server)
#
# Bawaan: APK ditaruh langsung di folder file publik ERPNext (lewat docker cp). Batas unggah ERPNext (5 MB)
# tidak berlaku karena file tidak diunggah lewat web. Untuk server di komputer lain, salin APK sendiri ke
# sites/<situs>/public/files/ lalu isi App Update di web (APK URL, Version Code, dst.).
# Butuh docker/.credentials.local (ADMIN_USER, ADMIN_PASSWORD) dan server hidup (BASE_URL, bawaan localhost:8082).
set -euo pipefail
cd "$(dirname "$0")/.."
ID="${1:?Pakai: $0 <build-id> [catatan] [--eas]}"
CATATAN="${2:-}"
MODE="${3:-server}"
BASE="${BASE_URL:-http://localhost:8082}"
set -a; . docker/.credentials.local; set +a
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

echo "• Membaca build $ID"
npx eas-cli build:view "$ID" --json 2>/dev/null > "$TMP/b.json"
read -r KODE NAMA URL < <(python3 - "$TMP/b.json" <<'PY'
import sys, json
d = json.load(open(sys.argv[1]))
assert d["status"] == "FINISHED", "Build belum selesai: " + d["status"]
print(d["appBuildVersion"], d["appVersion"], d["artifacts"]["applicationArchiveUrl"])
PY
)
echo "  versi $NAMA (code $KODE)"

if [ "$MODE" = "--eas" ]; then
  APK_URL="$URL"; UKURAN=0
else
  echo "• Mengunduh APK"
  curl -fsSL -o "$TMP/app.apk" "$URL"
  UKURAN=$(stat -f%z "$TMP/app.apk" 2>/dev/null || stat -c%s "$TMP/app.apk")
  echo "  $((UKURAN/1048576)) MB"
  NAMA_FILE="hris-$NAMA-$KODE.apk"
  echo "• Menaruh APK di server (file publik)"
  (cd docker && docker compose cp "$TMP/app.apk" "backend:/home/frappe/frappe-bench/sites/hris.localhost/public/files/$NAMA_FILE" >/dev/null \
    && docker compose exec -T -u root backend chown 1000:0 "sites/hris.localhost/public/files/$NAMA_FILE")
  APK_URL="/files/$NAMA_FILE"  # relatif: aplikasi memakai alamat servernya sendiri
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE$APK_URL")
  [ "$CODE" = 200 ] || { echo "APK tidak bisa diunduh dari $BASE$APK_URL (HTTP $CODE)"; exit 1; }
  # Simpan hanya APK terbaru dan satu sebelumnya (untuk kembali bila perlu); yang lebih lama dihapus agar disk tidak membengkak.
  (cd docker && docker compose exec -T -u root backend sh -c \
    'cd sites/hris.localhost/public/files && ls -t hris-*.apk 2>/dev/null | tail -n +3 | xargs -r rm -f -v' || true)
fi

echo "• Mengisi App Update"
curl -fsS -c "$TMP/c" -X POST "$BASE/api/method/login" -d "usr=$ADMIN_USER" --data-urlencode "pwd=$ADMIN_PASSWORD" > /dev/null
for kv in "version_code=$KODE" "version_name=$NAMA" "apk_url=$APK_URL" "apk_size=$UKURAN" "release_notes=$CATATAN" "mandatory=1"; do
  F="${kv%%=*}"; V="${kv#*=}"
  curl -fsS -b "$TMP/c" -X POST "$BASE/api/method/frappe.client.set_value" -d doctype="App Update" -d name="App Update" \
    -d fieldname="$F" --data-urlencode "value=$V" > /dev/null
done
echo "• Hasil yang dibaca aplikasi:"
curl -fsS "$BASE/api/method/hris_get_app_update"; echo
