#!/bin/sh
# Container entrypoint: prepares /data and initializes the PostgreSQL
# cluster on first boot, then hands over to supervisord (CMD).
set -eu

POSTGRES_USER="${POSTGRES_USER:-open}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-open}"
PGDATA="${PGDATA:-/data/pg}"

mkdir -p /data/uploads /data/exports /run/postgresql "$PGDATA"
chown postgres:postgres /run/postgresql
chown -R postgres:postgres "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] initializing postgres cluster at $PGDATA (user: $POSTGRES_USER)"
  PWFILE=/tmp/.initdb-pw
  printf '%s\n' "$POSTGRES_PASSWORD" > "$PWFILE"
  chown postgres:postgres "$PWFILE"
  su-exec postgres initdb -D "$PGDATA" \
    -U "$POSTGRES_USER" \
    --pwfile="$PWFILE" \
    --auth-local=trust \
    --auth-host=scram-sha-256
  rm -f "$PWFILE"
fi

exec "$@"
