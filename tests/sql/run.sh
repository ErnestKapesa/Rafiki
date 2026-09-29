#!/usr/bin/env bash
# Runs the migration + scenario tests against a throwaway local Postgres DB.
# Usage: tests/sql/run.sh   (needs psql + a server you can connect to as $PGUSER)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=rafiki_test_$$
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/auth_stub.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/20260929000000_rafiki_game.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/game.test.sql
