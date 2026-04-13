#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_ENV="${ROOT_DIR}/backend/.env"

required_vars=(
  SUPABASE_URL
  SUPABASE_KEY
  CVCRM_EMAIL
  CVCRM_TOKEN
  ADMIN_AUTH_SECRET
  ALLOWED_ORIGINS
  FRONTEND_URL
)

echo "[1/4] Checando Docker..."
command -v docker >/dev/null 2>&1 || { echo "Docker nao encontrado"; exit 1; }
docker version >/dev/null

echo "[2/4] Checando Docker Compose..."
docker compose version >/dev/null

echo "[3/4] Checando arquivo de ambiente do backend..."
if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "Arquivo ausente: ${BACKEND_ENV}"
  exit 1
fi

echo "[4/4] Validando variaveis obrigatorias..."
for var_name in "${required_vars[@]}"; do
  if ! grep -E "^${var_name}=" "${BACKEND_ENV}" >/dev/null; then
    echo "Variavel obrigatoria ausente: ${var_name}"
    exit 1
  fi
done

echo "Preflight OK: servidor pronto para subir stack VPS."
