#!/usr/bin/env bash
# Smoke test endpoint yang dipakai aplikasi, untuk tiga user uji (rani ESS, mss, hr).
# Pakai (dari folder docker/):  ./seed/smoke.sh        (VERBOSE=1 untuk menampilkan body respons)
# Kredensial dibaca dari docker/.credentials.local. Password/secret tidak pernah dicetak.
# Kode keluar 0 bila semua panggilan 200, selain itu 1.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -f .credentials.local ] || { echo "docker/.credentials.local belum ada. Jalankan ./seed/seed.sh dulu."; exit 2; }
set -a; . ./.credentials.local; set +a
BASE="${BASE_URL:-http://localhost:8082}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
FAIL=0; TODAY=$(date +%F)

# call LABEL JAR_OR_TOKENHEADER METHOD URL [curl args...]  -> cetak status, simpan body di $TMP/body
call() {
  local label="$1" auth="$2" url="$3"; shift 3
  local args=()
  if [ "$auth" = token ]; then args+=(-H "Authorization: token $API_KEY:$API_SECRET"); else args+=(-b "$TMP/$auth.jar"); fi
  local code
  code=$(curl -s -o "$TMP/body" -w '%{http_code}' "${args[@]}" "$@" "$url")
  [ "$code" = 200 ] || FAIL=1
  printf '  %-4s %s\n' "$code" "$label"
  [ -n "${VERBOSE:-}" ] && head -c 600 "$TMP/body" | sed 's/^/        /' && echo
  return 0
}

run_user() {
  local who="$1" email="$2" pwd="$3" auth="$4"
  echo "== $who ($email) [$auth]"
  if [ "$auth" != token ]; then
    local code
    code=$(curl -s -c "$TMP/$who.jar" -o "$TMP/body" -w '%{http_code}' -X POST "$BASE/api/method/login" -d "usr=$email" -d "pwd=$pwd")
    [ "$code" = 200 ] || FAIL=1; printf '  %-4s %s\n' "$code" "POST /api/method/login"
    auth="$who"
  fi
  call "GET frappe.auth.get_logged_user" "$auth" "$BASE/api/method/frappe.auth.get_logged_user"
  call "GET Employee (filter user_id)" "$auth" "$BASE/api/resource/Employee" -G \
    --data-urlencode "filters=[[\"user_id\",\"=\",\"$email\"]]" \
    --data-urlencode 'fields=["name","employee_name","employee_number","designation","department","date_of_joining"]'
  local emp; emp=$(python3 -c 'import sys,json
try: print(json.load(open(sys.argv[1]))["data"][0]["name"])
except Exception: print("")' "$TMP/body")
  call "GET hris_get_my_roles" "$auth" "$BASE/api/method/hris_get_my_roles"
  call "GET hris_get_my_approver" "$auth" "$BASE/api/method/hris_get_my_approver"
  call "GET hris_get_colleagues" "$auth" "$BASE/api/method/hris_get_colleagues"
  if [ -n "$emp" ]; then
    call "GET get_leave_details ($emp, $TODAY)" "$auth" \
      "$BASE/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details" -G \
      --data-urlencode "employee=$emp" --data-urlencode "date=$TODAY"
    call "GET Leave Application (milik $emp, status != Cancelled)" "$auth" "$BASE/api/resource/Leave%20Application" -G \
      --data-urlencode "filters=[[\"employee\",\"=\",\"$emp\"],[\"status\",\"!=\",\"Cancelled\"]]" \
      --data-urlencode 'fields=["name","employee","employee_name","leave_type","from_date","to_date","total_leave_days","status","leave_approver","leave_approver_name","description","posting_date"]' \
      --data-urlencode 'order_by=creation desc'
  else
    echo "  SKIP get_leave_details dan Leave Application (Employee user ini tidak terbaca)"; FAIL=1
  fi
}

run_user rani "$USER_EMAIL" "$USER_PASSWORD" cookie
[ -n "${API_KEY:-}" ] && [ -n "${API_SECRET:-}" ] && run_user rani-token "$USER_EMAIL" "" token
run_user mss "$MSS_USER_EMAIL" "$MSS_USER_PASSWORD" cookie
run_user hr "$HR_USER_EMAIL" "$HR_USER_PASSWORD" cookie
echo "== guest (harus 403)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/method/hris_get_colleagues"); printf '  %-4s %s\n' "$code" "GET hris_get_colleagues tanpa login"
[ "$code" = 403 ] || FAIL=1
[ "$FAIL" = 0 ] && echo "SEMUA OK" || echo "ADA YANG GAGAL"
exit $FAIL
