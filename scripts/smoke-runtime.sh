#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3200}"
LOG_FILE="${ROOT_DIR}/.objectos-smoke.log"

cd "${ROOT_DIR}"

pnpm --filter @objectos/server build >/dev/null

cd "${ROOT_DIR}/apps/objectos"
OS_ARTIFACT_FILE=dist/objectstack.json \
OS_PROJECT_ID="${OS_PROJECT_ID:-proj_local}" \
PORT="${PORT}" \
pnpm start >"${LOG_FILE}" 2>&1 &

PID="$!"
trap 'kill "${PID}" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then
    echo "ObjectOS smoke test passed on http://127.0.0.1:${PORT}"
    exit 0
  fi
  sleep 1
done

echo "ObjectOS smoke test failed. Last server logs:" >&2
tail -80 "${LOG_FILE}" >&2 || true
exit 1
