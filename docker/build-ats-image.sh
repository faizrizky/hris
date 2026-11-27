#!/usr/bin/env bash
# ===========================================================================
# Membangun image yang memuat sentra_ats di atas image dasar hris-erpnext (lihat Dockerfile.ats).
#
#   ./build-ats-image.sh [akhiran]      akhiran bawaan: git sha pendek, atau "local" di luar repo git
#
# Hasil: <CUSTOM_IMAGE>:<BASE_TAG>-ats-<akhiran>. Baris terakhir keluaran adalah nama image itu.
# Image dasar tidak pernah ditimpa; tag yang sedang berjalan bisa dikembalikan kapan saja.
# ===========================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[ -f .env ] && { set -a; . ./.env; set +a; }

IMAGE="${CUSTOM_IMAGE:-hris-erpnext}"
BASE_TAG="${BASE_TAG:-16}"   # tag image dasar; sengaja bukan CUSTOM_TAG, yang berubah menjadi tag rilis
SUFFIX="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
TAG="${BASE_TAG}-ats-${SUFFIX}"

docker image inspect "$IMAGE:$BASE_TAG" >/dev/null 2>&1 \
  || { echo "ERROR: image dasar $IMAGE:$BASE_TAG tidak ada. Jalankan ./build-image.sh dulu." >&2; exit 1; }

ctx="$(mktemp -d)"
trap 'rm -rf "$ctx"' EXIT
rsync -a --exclude '__pycache__' --exclude 'screenshots' --exclude '.git' apps/sentra_ats "$ctx/"
cp Dockerfile.ats "$ctx/"

echo "==> Membangun $IMAGE:$TAG di atas $IMAGE:$BASE_TAG" >&2
DOCKER_BUILDKIT=1 docker build --quiet --build-arg "BASE_IMAGE=$IMAGE:$BASE_TAG" \
  --tag "$IMAGE:$TAG" --file "$ctx/Dockerfile.ats" "$ctx" >&2

echo "==> Memeriksa isi image" >&2
docker run --rm --entrypoint bash "$IMAGE:$TAG" -c \
  'env/bin/python -c "import sentra_ats, playwright, scrapling, pdfplumber, rapidfuzz; print(\"sentra_ats dan dependensinya terpasang\")"' >&2
echo "$IMAGE:$TAG"
