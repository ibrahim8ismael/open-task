#!/bin/sh
# Backend supervisor program: waits for postgres, ensures the database
# exists, runs migrations, then starts the API.
set -eu

POSTGRES_USER="${POSTGRES_USER:-open}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-open}"
POSTGRES_DB="${POSTGRES_DB:-opentask}"
SOCKET_DIR="/run/postgresql"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
# Local admin ops go over the unix socket (trust auth), so we can sync the
# role password with the environment without knowing the current one.
export PGUSER="$POSTGRES_USER"
export PGHOST="$SOCKET_DIR"

echo "[backend] waiting for postgres..."
i=0
until pg_isready -q; do
  i=$((i + 1))
  if [ "$i" -ge 120 ]; then
    echo "[backend] postgres did not become ready in time"
    exit 1
  fi
  sleep 1
done

# Keep the superuser password in sync with POSTGRES_PASSWORD (idempotent).
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")
psql -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER \"${POSTGRES_USER}\" WITH PASSWORD '${ESCAPED_PW}';" >/dev/null

# Create the app database if it does not exist yet.
if ! psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1; then
  echo "[backend] creating database ${POSTGRES_DB}"
  createdb "$POSTGRES_DB"
fi

cd /app/backend
echo "[backend] running migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[backend] starting API on port ${PORT:-4040}"
exec node dist/main.js
