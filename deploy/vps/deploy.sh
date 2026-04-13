#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${SCRIPT_DIR}"

./preflight.sh

echo "Subindo stack..."
docker compose up -d --build

echo "Status da stack:"
docker compose ps

echo "Deploy concluido."
