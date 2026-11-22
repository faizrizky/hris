#!/usr/bin/env bash
# Daftar override klien dan tandai yang basisnya (skrip utama) berubah setelah override terakhir diedit.
# Pakai (dari folder docker/):  ./clients-cek.sh
cd "$(dirname "${BASH_SOURCE[0]}")"
for f in clients/*/server-scripts/*.py; do
  [ -e "$f" ] || continue
  site=$(echo "$f" | cut -d/ -f2); name=$(basename "$f"); base="server-scripts/$name"
  if [ ! -f "$base" ]; then echo "[khusus] $site  $name (tidak ada di kode utama)"; continue; fi
  o=$(git log -1 --format=%ct -- "$f" 2>/dev/null); b=$(git log -1 --format=%ct -- "$base" 2>/dev/null)
  if [ -n "$o" ] && [ -n "$b" ] && [ "$b" -gt "$o" ]; then echo "[PERIKSA] $site  $name: kode utama berubah setelah override"
  else echo "[ok]      $site  $name"; fi
done
