#!/usr/bin/env bash
# Mengirim perubahan JavaScript/aset ke HP tanpa build ulang (EAS Update). HP mengambilnya saat aplikasi dibuka
# (layar pembuka: "Memperbarui aplikasi…") lalu memuat ulang sendiri.
#
# Pakai:  ./scripts/kirim-update.sh "pesan perubahan"
#         PUSH=1 ./scripts/kirim-update.sh "pesan"   # sekalian kirim push "pembaruan tersedia" (bawaan: tidak)
#
# Hanya untuk perubahan JavaScript, teks, animasi, dan gambar. Perubahan native (library native, modul hris-clock /
# hris-face, izin, ikon, splash native, pengaturan native di app.json) butuh build baru; update untuk build yang
# runtime-nya berbeda otomatis tidak dikirim ke HP itu (runtime version = fingerprint proyek).
set -euo pipefail
cd "$(dirname "$0")/.."
PESAN="${1:?Pakai: $0 \"pesan perubahan\"}"
npx tsc --noEmit

# Pengaman: bundel harus memakai server asli (bukan data contoh). Cache Metro yang basi pernah membuat update
# terbit tanpa alamat server, sehingga aplikasi memakai data contoh. Variabel ada di EAS (environment preview).
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
npx eas-cli env:exec preview "npx expo export --clear --platform android --no-bytecode --no-minify --output-dir $TMP" --non-interactive >/dev/null 2>&1
JS=$(ls "$TMP"/_expo/static/js/android/*.js | head -1)
if ! grep -q "var hrisApi = _erpnextApi.erpnextApi" "$JS" || ! grep -q 'var DEFAULT_SERVER_ADDRESS = "http' "$JS"; then
  echo "BATAL: bundel tidak memuat alamat server / memakai data contoh. Periksa env EAS preview (eas env:list preview)."; exit 1
fi
echo "Bundel memakai server asli."

npx eas-cli update --clear-cache --channel preview --environment preview --platform android --non-interactive --message "$PESAN"

if [ "${PUSH:-0}" = 1 ]; then
  ./scripts/push-rilis.sh "Pembaruan HRIS tersedia" "$PESAN" || echo "  (push gagal, update tetap terbit)"
fi
