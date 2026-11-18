#!/usr/bin/env bash
# Aplica stubs + migrações + seed em um banco PostgreSQL descartável e roda os testes SQL.
# Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/db-test.sh
# Não precisa do stack do Supabase: usa stubs mínimos de auth/storage (supabase/tests/_stubs.sql).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${RITMO_TEST_DB:-ritmo_test}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL -d postgres -c "drop database if exists \"$DB\";" -c "create database \"$DB\";"
$PSQL -d "$DB" -f supabase/tests/_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "migração: $f"
  $PSQL -d "$DB" -f "$f"
done
$PSQL -d "$DB" -f supabase/seed.sql
$PSQL -d "$DB" -f supabase/tests/_helpers.sql

fail=0
for f in supabase/tests/[0-9]*.sql; do
  if ! $PSQL -d "$DB" -o /dev/null -f "$f" 2>&1 | sed "s/^psql:[^:]*:[0-9]*: NOTICE:  //"; then
    echo "✗ $f"; fail=1
  fi
done
if [ "$fail" = 0 ]; then echo "✔ todos os testes SQL passaram"; else echo "✗ há testes falhando"; exit 1; fi
