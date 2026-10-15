#!/usr/bin/env bash
# Mengirim perubahan JavaScript/aset ke HP tanpa build ulang (EAS Update). HP mengambilnya saat aplikasi dibuka
# (layar pembuka: "Memperbarui aplikasi…") lalu memuat ulang sendiri.
#
# Pakai:  ./scripts/kirim-update.sh "pesan perubahan"
#
# Hanya untuk perubahan JavaScript, teks, animasi, dan gambar. Perubahan native (library native, modul hris-clock /
# hris-face, izin, ikon, splash native, pengaturan native di app.json) butuh build baru; update untuk build yang
# runtime-nya berbeda otomatis tidak dikirim ke HP itu (runtime version = fingerprint proyek).
set -euo pipefail
cd "$(dirname "$0")/.."
PESAN="${1:?Pakai: $0 \"pesan perubahan\"}"
npx tsc --noEmit
npx eas-cli update --channel preview --environment preview --platform android --non-interactive --message "$PESAN"
