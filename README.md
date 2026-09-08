# Open-Task — internal runbook

## Local dev

```bash
cp .env.example .env                    # fill SESSION_SECRET etc.
docker compose -f docker-compose.dev.yml up -d db   # Postgres 16 on :5432
pnpm install
pnpm --filter backend db:migrate        # prisma migrate dev
pnpm --filter backend db:seed           # ADMIN_EMAILS superadmins
pnpm dev:backend                        # Nest on :4040
pnpm dev:web                            # apps/web on :3000 (VITE_API_BASE_URL=:4040)
```

Sign in at http://localhost:3000 (email+password, magic code, or seeded admin).

## Production

```bash
cp .env.example .env    # set real SESSION_SECRET (>=32 chars), ADMIN_EMAILS, POSTGRES_*
docker compose up -d --build       # db + backend:4040 + web:3000
docker compose exec backend pnpm db:deploy   # apply pending migrations
docker compose exec backend pnpm db:seed     # promote ADMIN_EMAILS to superuser
```

Environment (backend): `DATABASE_URL`, `SESSION_SECRET`, `WEB_BASE_URL`, `PORT=4040`,
`ADMIN_EMAILS`, `ADMIN_INITIAL_PASSWORD` (>=12 chars, only used to bootstrap missing
admin accounts), `SMTP_*` (optional; email fanout stub until set), `UPLOAD_PROVIDER=local`,
`FILE_SIZE_LIMIT` (bytes, default 5MB), `EXPORT_DIR`, `HARD_DELETE_AFTER_DAYS` (default 30),
`WEBHOOK_ALLOW_PRIVATE` (dev only — never set in prod), `COOKIE_SECURE` (empty=auto —
secure only when `WEB_BASE_URL` is `https://`; fixes login loop on plain-http compose),
`API_KEY_RATE_LIMIT` (default `300/minute`), `AUTH_RATE_LIMIT` (default `30/minute`,
per-IP per auth scope — format `"<num>/<period>"` where period is `second|minute|hour`).

## Backups (Postgres volume `pgdata`)

```bash
# nightly dump (cron)
docker compose exec db pg_dump -U open opentask | gzip > backup-$(date +%F).sql.gz
# restore
gunzip -c backup-2026-09-07.sql.gz | docker compose exec -T db psql -U open opentask
```

Uploaded files live in `./uploads/`, generated exports in `./exports/` — include both
in file-level backups.

## Health

- `GET :4040/health` — backend liveness
- `GET :4040/api/instances/` — static instance info

## Notes

- Backend serves `:4040` (owner decision); web dev/build points `VITE_API_BASE_URL` there.
- Legacy `apps/api/` (Python) is reference-only; parked apps (`admin/space/live/proxy`)
  stay out of the v1 workspaces.
- Crons run in-process: notification fanout (5m), GC (hourly), hard-delete (00:00),
  archive_and_close (01:00).
