#!/usr/bin/env bash
# Applies the migration + seed to a scratch database and runs the RLS/booking tests.
# Usage: PGHOST=/tmp PGPORT=5499 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=threshold_test
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/supabase_stub.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/migrations/20260928000000_threshold_core.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/seed.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/booking_rls.sql
