#!/bin/sh
# Backend entrypoint: waits for postgres and runs migrations before starting API.
set -eu

# DATABASE_URL is expected via environment (docker-compose provides it)
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backend-entrypoint] DATABASE_URL not set, skipping migrate"
  exec "$@"
fi

echo "[backend-entrypoint] running prisma migrate deploy..."
# Retry up to 30 times (db may still be starting even with healthcheck)
i=0
while true; do
  if ./node_modules/.bin/prisma migrate deploy; then
    echo "[backend-entrypoint] migrations applied"
    break
  fi
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[backend-entrypoint] migrate failed after 30 attempts"
    exit 1
  fi
  echo "[backend-entrypoint] migrate failed, retry $i/30 in 2s..."
  sleep 2
done

exec "$@"
