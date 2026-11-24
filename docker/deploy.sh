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
SSH=(ssh -i "$KEY" -o ConnectTimeout=15 "$HOST")

git diff --quiet HEAD -- . || { echo "ERROR: ada perubahan di docker/ yang belum di-commit. Commit dulu." >&2; exit 1; }
SHA="$(git rev-parse --short HEAD)"

echo "==> Mengirim docker/ pada commit $SHA ke $HOST:~/$DIR"
git archive --format=tar "HEAD:$(git rev-parse --show-prefix | sed 's:/$::')" | "${SSH[@]}" "mkdir -p $DIR && tar -x -C $DIR"

echo "==> Membangun image di server"
TAG="$("${SSH[@]}" "cd $DIR && ./build-ats-image.sh $SHA | tail -1")"
echo "    $TAG"

echo "==> Rilis"
"${SSH[@]}" "cd $DIR && ./release.sh ${TAG#*:}"
