#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with a stub auth schema) and runs the RLS tests.
# Requires Postgres binaries (initdb, pg_ctl, psql). Nothing touches your Supabase project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
# initdb refuses to run as root: use the postgres system user when needed.
if [ "$(id -u)" = "0" ]; then RUN="su postgres -c"; chown -R postgres "$TMP"; else RUN="bash -c"; fi
cleanup() { $RUN "$PGBIN/pg_ctl -D '$TMP/data' stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
$RUN "$PGBIN/initdb -D '$TMP/data' -U postgres -A trust >/dev/null"
$RUN "$PGBIN/pg_ctl -D '$TMP/data' -o '-p $PORT -k $TMP' -l '$TMP/log' start >/dev/null"

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database league_test" >/dev/null
"${PSQL[@]}" -d league_test -f "$ROOT/supabase/tests/auth-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -d league_test -f "$f"
done
"${PSQL[@]}" -d league_test -f "$ROOT/supabase/tests/rls.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /' | grep -v '^[[:space:]]*$\|^[0-9a-f-]\{36\}$'
