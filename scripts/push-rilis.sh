#!/usr/bin/env bash
# Mengumumkan pembaruan aplikasi lewat push ke semua token terdaftar (doctype Push Token), satu permintaan per token.
# Dipanggil otomatis oleh rilis-apk.sh; kirim-update.sh (OTA) memanggilnya hanya bila PUSH=1.
# Pakai (dari akar proyek):  ./scripts/push-rilis.sh "judul" "isi"   (SKIP: NO_PUSH=1)
# Kredensial HR dibaca dari docker/.credentials.local (di-ignore git). Tidak ada rahasia yang dicetak.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -f docker/.credentials.local ] || { echo "docker/.credentials.local belum ada"; exit 2; }
set -a; . docker/.credentials.local; set +a
BASE="${BASE_URL:-http://localhost:8082}"
JUDUL="${1:-Pembaruan HRIS tersedia}"
ISI="${2:-Buka aplikasi untuk memperbarui.}"
[ "${NO_PUSH:-0}" = 1 ] && { echo "Push dilewati (NO_PUSH=1)"; exit 0; }
FILTER=""
JAR=$(mktemp); trap 'rm -f "$JAR"' EXIT
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/method/login" -d "usr=$HR_USER_EMAIL" -d "pwd=$HR_USER_PASSWORD"
curl -s -b "$JAR" -G "$BASE/api/resource/Push%20Token" \
  --data-urlencode 'fields=["user","token","platform","device_name","last_seen"]' \
  --data-urlencode 'limit_page_length=200' > "$JAR.tokens"
python3 - "$JAR.tokens" "$FILTER" "$JUDUL" "$ISI" <<'PY'
import json, sys, urllib.request, time
rows = json.load(open(sys.argv[1])).get("data", [])
f = sys.argv[2].lower()
rows = [r for r in rows if not f or f in (r.get("user") or "").lower()]
if not rows:
    sys.exit("Tidak ada Push Token terdaftar.")
print(f"{len(rows)} token ditemukan:")
for r in rows:
    print(f"  - {r['user']} | {r.get('platform')} | {r.get('device_name')} | terakhir {r.get('last_seen')}")
msgs = [{"to": r["token"], "title": sys.argv[3], "body": sys.argv[4],
         "sound": "default", "channelId": "default", "data": {"pembaruan": True}} for r in rows]
def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", "Accept": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
# Satu permintaan per token: satu batch dengan token dari beberapa proyek Expo ditolak seluruhnya (400).
ids = []
for r, m in zip(rows, msgs):
    res = post("https://exp.host/--/api/v2/push/send", [m])
    if res.get("error"):
        print(f"  kirim ke {r['user']} ({r.get('device_name')}): GAGAL {res['error']}")
        continue
    t = (res.get("data") or [{}])[0]
    print(f"  kirim ke {r['user']} ({r.get('device_name')}): {t.get('status')}" + (f" ({t.get('message')})" if t.get("message") else ""))
    if t.get("id"): ids.append(t["id"])
if ids:
    time.sleep(8)
    rc = post("https://exp.host/--/api/v2/push/getReceipts", {"ids": ids}).get("data", {})
    for k, v in rc.items():
        det = (v.get("details") or {}).get("error")
        print(f"  receipt {k[:8]}…: {v.get('status')}" + (f" - {det or v.get('message')}" if v.get("status") != "ok" else ""))
    print("Receipt 'ok' artinya FCM menerima. InvalidCredentials = kunci FCM V1 belum terpasang. DeviceNotRegistered = token kedaluwarsa (aplikasi lama dihapus).")
PY
rm -f "$JAR.tokens"
