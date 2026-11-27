#!/usr/bin/env bash
# ===========================================================================
# Deploy dari Mac: kode yang SUDAH di-commit -> image di server -> backup -> migrate semua site -> uji cepat.
#
#   ./deploy.sh [user@host]
#
# Variabel (opsional): DEPLOY_HOST (bawaan infra@10.70.0.30), DEPLOY_KEY, DEPLOY_DIR (bawaan hris-docker).
# Hanya isi commit yang dikirim (git archive), jadi file yang belum di-commit tidak pernah ikut terpasang
# dan server selalu sesuai dengan git. Rollback: ssh ke server lalu ./release.sh --rollback.
# ===========================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

HOST="${1:-${DEPLOY_HOST:-infra@10.70.0.30}}"
KEY="${DEPLOY_KEY:-$HOME/Downloads/private_key_rsa_2048.pem}"
DIR="${DEPLOY_DIR:-hris-docker}"
SSH=(ssh -i "$KEY" -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=6 "$HOST")

git diff --quiet HEAD -- . || { echo "ERROR: ada perubahan di docker/ yang belum di-commit. Commit dulu." >&2; exit 1; }
SHA="$(git rev-parse --short HEAD)"

# Dijalankan dari akar repo: git archive memotong isi menurut folder kerja, sehingga dari dalam docker/
# arsipnya kosong (itulah bug sebelumnya).
ROOT="$(git rev-parse --show-toplevel)"
PREFIX="$(git rev-parse --show-prefix)"; PREFIX="${PREFIX%/}"
ARCHIVE=(git -C "$ROOT" archive --format=tar "HEAD:$PREFIX")
[ "$("${ARCHIVE[@]}" | tar -t | grep -c .)" -gt 10 ] || { echo "ERROR: arsip commit kosong atau terlalu kecil." >&2; exit 1; }

echo "==> Mengirim docker/ pada commit $SHA ke $HOST:~/$DIR"
"${ARCHIVE[@]}" | "${SSH[@]}" "mkdir -p $DIR && tar -x -C $DIR"

# Pastikan benar-benar tiba: bandingkan hash skrip rilis di server dengan yang ada di commit.
WANT="$(git -C "$ROOT" show "HEAD:$PREFIX/release.sh" | shasum -a 256 | cut -d' ' -f1)"
HAVE="$("${SSH[@]}" "sha256sum $DIR/release.sh" | cut -d' ' -f1)"
[ "$WANT" = "$HAVE" ] || { echo "ERROR: berkas di server tidak sama dengan commit $SHA; deploy dihentikan." >&2; exit 1; }

echo "==> Membangun image dan merilis di server (berjalan lepas dari koneksi ssh)"
# Build memakan beberapa menit; koneksi yang putus dulu menggagalkan rilis. Sekarang server menjalankannya sendiri
# (nohup) dan kita hanya membaca lognya.
LOG="deploy-$SHA.log"
"${SSH[@]}" "cd $DIR && rm -f $LOG && (nohup bash -c './build-ats-image.sh $SHA > $LOG 2>&1 && ./release.sh \$(tail -1 $LOG | sed s/.*://) >> $LOG 2>&1; echo EXIT=\$? >> $LOG' >/dev/null 2>&1 &)"
code=""
for _ in $(seq 1 120); do
  sleep 15
  code="$("${SSH[@]}" "sed -n 's/^EXIT=//p' $DIR/$LOG" 2>/dev/null || true)"
  [ -n "$code" ] && break
done
"${SSH[@]}" "grep -E '^(==>|   |!!|--)|ERROR' $DIR/$LOG | tail -30" || true
[ "$code" = 0 ] || { echo "ERROR: rilis gagal atau belum selesai; lihat ~/$DIR/$LOG di server." >&2; exit 1; }
