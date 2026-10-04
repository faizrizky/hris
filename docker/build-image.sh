#!/usr/bin/env bash
# ===========================================================================
# Membangun image lokal berisi frappe + erpnext + hrms (Frappe HR).
#
# Kenapa harus build sendiri: image resmi frappe/erpnext di Docker Hub hanya
# memuat app `frappe` dan `erpnext`. Di Frappe, daftar app itu bagian dari
# image, bukan sesuatu yang bisa dipasang ke container yang sudah jalan
# (`bench get-app` di dalam container akan hilang begitu container dibuat
# ulang). Jadi `hrms` harus diikutkan pada tahap build, lewat apps.json.
#
# Script ini mengikuti alur resmi frappe_docker (images/layered/Containerfile
# + apps.json sebagai BuildKit secret), jadi tinggal:
#
#     ./build-image.sh
#
# Butuh sekitar 10-30 menit saat pertama kali, tergantung kecepatan internet.
# Untuk memaksa ambil ulang source app terbaru:
#
#     ./build-image.sh --no-cache
#
# Argumen apa pun yang kamu berikan diteruskan apa adanya ke `docker build`.
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Baca .env kalau ada, supaya nama image di sini sama dengan yang dipakai
# docker-compose.yml.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

CUSTOM_IMAGE="${CUSTOM_IMAGE:-hris-erpnext}"
CUSTOM_TAG="${CUSTOM_TAG:-16}"
FRAPPE_BRANCH="${FRAPPE_BRANCH:-version-16}"
CLONE_DIR="$SCRIPT_DIR/.frappe_docker"
APPS_JSON="$SCRIPT_DIR/apps.json"

# --- Pemeriksaan prasyarat -------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: perintah 'docker' tidak ditemukan."
  echo "Pasang Docker Desktop dulu: https://docs.docker.com/desktop/setup/install/mac-install/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker tidak merespons."
  echo "Buka aplikasi Docker Desktop dan tunggu ikon paus di menu bar berhenti berkedip."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: perintah 'git' tidak ditemukan. Jalankan: xcode-select --install"
  exit 1
fi

if [ ! -f "$APPS_JSON" ]; then
  echo "ERROR: $APPS_JSON tidak ada. Berkas itu yang menentukan app apa saja"
  echo "yang masuk ke dalam image."
  exit 1
fi

# --- Ambil konteks build resmi --------------------------------------------
# Containerfile dan berkas pendukungnya (resources/*.sh) hanya ada di repo
# frappe_docker, jadi repo itu di-clone sebagai konteks build. Isinya tidak
# perlu disimpan di git repo HRIS; sudah diabaikan lewat .gitignore.
if [ ! -d "$CLONE_DIR/.git" ]; then
  echo "==> Meng-clone frappe_docker sebagai konteks build..."
  git clone --depth 1 https://github.com/frappe/frappe_docker "$CLONE_DIR"
else
  echo "==> Memperbarui clone frappe_docker yang sudah ada..."
  git -C "$CLONE_DIR" fetch --depth 1 origin main
  git -C "$CLONE_DIR" reset --hard origin/main
fi

# --- Build -----------------------------------------------------------------
# apps.json dikirim sebagai --secret, bukan --build-arg. Ini anjuran resmi:
# nilai --build-arg tersimpan permanen dan bisa dibaca lewat
# `docker image history`, sedangkan secret tidak masuk ke layer image.
# Butuh Docker Engine v23+ (BuildKit sudah jadi builder default di sana).
#
# Tidak ada --platform di sini: di Apple Silicon, Docker otomatis memakai
# varian arm64 dari image dasar frappe/build dan frappe/base, sehingga hasil
# build-nya native dan tidak lewat emulasi.
echo "==> Membangun $CUSTOM_IMAGE:$CUSTOM_TAG (branch $FRAPPE_BRANCH)"
echo "==> App yang diikutkan:"
cat "$APPS_JSON"
echo

DOCKER_BUILDKIT=1 docker build \
  --build-arg "FRAPPE_PATH=https://github.com/frappe/frappe" \
  --build-arg "FRAPPE_BRANCH=$FRAPPE_BRANCH" \
  --secret "id=apps_json,src=$APPS_JSON" \
  --tag "$CUSTOM_IMAGE:$CUSTOM_TAG" \
  --file "$CLONE_DIR/images/layered/Containerfile" \
  ${@+"$@"} \
  "$CLONE_DIR"

echo
echo "==> Selesai. Memeriksa hasil:"
echo -n "Arsitektur image : "
docker image inspect --format '{{.Architecture}}' "$CUSTOM_IMAGE:$CUSTOM_TAG"
echo -n "Ukuran image     : "
docker image inspect --format '{{.Size}}' "$CUSTOM_IMAGE:$CUSTOM_TAG" \
  | awk '{printf "%.1f GB\n", $1/1024/1024/1024}'
echo -n "App di dalamnya  : "
docker run --rm --entrypoint bash "$CUSTOM_IMAGE:$CUSTOM_TAG" \
  -c 'ls -1 /home/frappe/frappe-bench/apps | tr "\n" " "'
echo
echo
echo "Di Apple Silicon, arsitektur di atas semestinya 'arm64'. Kalau yang"
echo "muncul 'amd64', image berjalan lewat emulasi dan akan terasa lambat;"
echo "lihat bagian Pemecahan Masalah di README.md."
echo
echo "Langkah berikutnya:  docker compose up -d"
