-- Threshold — schema, RLS and booking tests. Run via supabase/tests/run.sh.
\set QUIET on
\set ON_ERROR_STOP on
\o /dev/null

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- Tries to book as the current user; returns the error message or 'ok'.
create or replace function pg_temp.try_book(p_guide uuid, p_start timestamptz, p_type public.session_type default 'solo', p_letter text default 'Dear me.')
returns text language plpgsql as $$
begin
  perform public.book_session(p_guide, 'divorce', null, p_type, p_start, 'Test', 'Europe/London',
    '[{"position":1,"prompt":"What is ending?","answer":"A marriage."},{"position":2,"prompt":"Q2","answer":null},{"position":3,"prompt":"Q3","answer":""}]'::jsonb,
    p_letter);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- A fresh Mara day with no sessions, at least three days out.
create temp table fx as
select d::date as day
from generate_series(((now() at time zone 'Europe/Lisbon')::date + 3), ((now() at time zone 'Europe/Lisbon')::date + 40), interval '1 day') d
where extract(dow from d) in (1, 2, 4)
  and not exists (
    select 1 from public.sessions s
    where s.guide_id = '10000000-0000-4000-8000-000000000001'
      and (s.starts_at at time zone 'Europe/Lisbon')::date = d::date)
order by d limit 1;
grant select on fx to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000aaaa', 'a@test', '{"display_name":"A"}'),
  ('00000000-0000-4000-8000-00000000bbbb', 'b@test', '{}');

-- ---------------------------------------------------------------------------
select pg_temp.check((select count(*) from public.sessions) = 25, 'seed: all 25 sessions placed on open days');
select pg_temp.check((select count(*) from public.future_self_letters) = 2, 'seed: two letters');
select pg_temp.check((select count(*) from public.profiles) = 5, 'trigger: profiles created for new auth users');
select pg_temp.check(not exists (
  select 1 from public.sessions a join public.sessions b
    on a.guide_id = b.guide_id and a.id < b.id and a.blocked_range && b.blocked_range
), 'seed: no two held spans touch');

-- --- Guest -----------------------------------------------------------------
set role anon;
select pg_temp.check((select count(*) from public.guides) = 7, 'anon: reads guides');
select pg_temp.check((select count(*) from public.thresholds) = 9, 'anon: reads thresholds');
select pg_temp.check((select count(*) from public.availability_rules) > 0, 'anon: reads availability');
select pg_temp.check((select count(*) from public.sessions) = 0, 'anon: cannot see sessions');
select pg_temp.check((select count(*) from public.reflective_answers) = 0, 'anon: cannot see answers');
select pg_temp.check((select count(*) from public.future_self_letters) = 0, 'anon: cannot see letters');
select pg_temp.check((select count(*) from public.guide_busy_ranges('10000000-0000-4000-8000-000000000001', now() - interval '30 days', now() + interval '30 days')) >= 5, 'anon: busy ranges are visible, without identities');
do $$ begin
  perform public.book_session('10000000-0000-4000-8000-000000000001', null, null, 'solo', now() + interval '3 days', 'x', 'UTC', '[]', null);
  raise exception 'FAIL: anon booked';
exception when insufficient_privilege then raise notice 'ok  anon: cannot book';
end $$;
reset role;

-- --- Inês, the demo client -------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
select pg_temp.check((select count(*) from public.sessions) = 2, 'client: sees only her own two sessions');
select pg_temp.check((select count(*) from public.my_letters()) = 2, 'client: two letter envelopes');
select pg_temp.check((select count(*) from public.my_letters() where is_open and body is not null) = 1, 'client: past letter is unsealed');
select pg_temp.check((select count(*) from public.my_letters() where not is_open and body is null) = 1, 'client: upcoming letter stays sealed (no body)');
select pg_temp.check((select count(*) from public.future_self_letters) = 1, 'client: RLS returns only the unsealed letter row');
do $$ begin
  update public.profiles set role = 'guide' where id = auth.uid();
  raise exception 'FAIL: client promoted herself';
exception when insufficient_privilege then raise notice 'ok  client: cannot change own role';
end $$;
reset role;

-- --- Mara, the demo Guide ----------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b1';
select pg_temp.check((select count(*) from public.sessions) = 7, 'guide: sees her seven sessions');
select pg_temp.check((select count(distinct guide_id) from public.sessions) = 1, 'guide: sees no other Guide''s sessions');
select pg_temp.check((select count(*) from public.reflective_answers) = 21, 'guide: reads answers for her sessions');
select pg_temp.check((select count(*) from public.future_self_letters) = 0, 'guide: can never read letters');
select pg_temp.check((select count(*) from public.my_letters()) = 0, 'guide: has no envelopes of her own');
reset role;

-- --- Booking ----------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '10:00') at time zone 'Europe/Lisbon') = 'ok', 'book: open slot is held');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '10:00') at time zone 'Europe/Lisbon') = 'slot_taken', 'book: same client, same time → slot_taken');
select pg_temp.check((select count(*) from public.reflective_answers where client_id = auth.uid()) = 3, 'book: answers stored');
select pg_temp.check((select count(*) from public.reflective_answers where client_id = auth.uid() and answer is null) = 2, 'book: blank answers stored as "bring it into the room"');
select pg_temp.check((select unlocks_at - s.ends_at from public.future_self_letters l join public.sessions s on s.id = l.session_id where l.client_id = auth.uid()) is null, 'book: sealed letter invisible to author via table');
select pg_temp.check((select unlocks_at - (select ends_at from public.sessions where client_id = auth.uid()) from public.my_letters()) = interval '48 hours', 'book: letter unlocks 48h after session end');
select pg_temp.check((select blocked_range = tstzrange(starts_at - interval '45 min', ends_at + interval '45 min', '[)') from public.sessions where client_id = auth.uid()), 'book: 45-minute buffers either side');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000bbbb';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '10:00') at time zone 'Europe/Lisbon') = 'slot_taken', 'book: same slot for another client → slot_taken');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '12:00') at time zone 'Europe/Lisbon') = 'slot_taken', 'book: 30 min after end (buffers overlap) → slot_taken');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '12:45') at time zone 'Europe/Lisbon', 'solo', null) = 'slot_taken', 'book: 75 min after end → still slot_taken');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '13:00') at time zone 'Europe/Lisbon', 'solo', null) = 'ok', 'book: exactly 90 min after end (buffers meet) → held');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '15:30') at time zone 'Europe/Lisbon') = 'slot_taken', 'book: a third that would touch stillness → slot_taken');
reset role;
-- Daily limit: with Mara holding one a day, a clean second hour on a fresh day is refused.
create temp table fx2 as
select d::date as day
from generate_series((select day from fx) + 1, (select day from fx) + 30, interval '1 day') d
where extract(dow from d) in (1, 2, 4)
  and not exists (select 1 from public.sessions s where s.guide_id = '10000000-0000-4000-8000-000000000001' and (s.starts_at at time zone 'Europe/Lisbon')::date = d::date)
order by d limit 1;
grant select on fx2 to authenticated;
update public.guides set max_sessions_per_day = 1 where id = '10000000-0000-4000-8000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000bbbb';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx2) + time '10:00') at time zone 'Europe/Lisbon', 'solo', null) = 'ok', 'limit: first of the day is held');
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx2) + time '14:00') at time zone 'Europe/Lisbon', 'solo', null) = 'day_full', 'limit: a clean second hour that day → day_full');
reset role;
update public.guides set max_sessions_per_day = 2 where id = '10000000-0000-4000-8000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000bbbb';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', now() + interval '2 hours') = 'too_soon', 'book: under 24h notice → too_soon');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + 1 + time '10:10') at time zone 'Europe/Lisbon') = 'off_grid', 'book: off the 15-minute grid → off_grid');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '09:30') at time zone 'Europe/Lisbon') = 'outside_availability', 'book: 09:30 start, pre-buffer would begin before 09:00 window → outside_availability');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) - extract(dow from (select day from fx))::int + 7 + time '11:00') at time zone 'Europe/Lisbon') = 'outside_availability', 'book: Sunday → outside_availability');
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '16:00') at time zone 'Europe/Lisbon' + interval '7 days', 'aftermath') = 'outside_availability', 'book: aftermath overruns the window → outside_availability');

-- Cancellation
do $$
declare v uuid;
begin
  select id into v from public.sessions where client_id = '00000000-0000-4000-8000-00000000aaaa';
  begin
    perform public.cancel_session(v);
    raise exception 'FAIL: cancelled another client''s session';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok  cancel: cannot release someone else''s session';
  end;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
select public.cancel_session((select id from public.sessions where client_id = auth.uid()));
select pg_temp.check((select status from public.sessions where client_id = auth.uid()) = 'cancelled', 'cancel: session released');
select pg_temp.check((select is_open and body = 'Dear me.' from public.my_letters()), 'cancel: letter returned unopened');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000bbbb';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000001', ((select day from fx) + time '10:00') at time zone 'Europe/Lisbon', 'solo', null) = 'ok', 'cancel: released time can be held again');
reset role;


-- --- Rescheduling ------------------------------------------------------------
create or replace function pg_temp.try_move(p_session uuid, p_start timestamptz)
returns text language plpgsql as $$
begin
  perform public.reschedule_session(p_session, p_start);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- A fresh Tobias day for moves (Mon–Thu 08:00–16:00, Berlin).
create temp table fx3 as
select d::date as day
from generate_series((now() at time zone 'Europe/Berlin')::date + 3, (now() at time zone 'Europe/Berlin')::date + 40, interval '1 day') d
where extract(dow from d) between 1 and 4
  and not exists (select 1 from public.sessions s where s.guide_id = '10000000-0000-4000-8000-000000000002' and (s.starts_at at time zone 'Europe/Berlin')::date = d::date)
order by d limit 1;
grant select on fx3 to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-00000000cccc', 'c@test', '{}');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000cccc';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000002', ((select day from fx3) + time '09:00') at time zone 'Europe/Berlin', 'solo', 'Dear me.') = 'ok', 'move: session to move is held');
create temp table mv as select id from public.sessions where client_id = '00000000-0000-4000-8000-00000000cccc';
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '13:00') at time zone 'Europe/Berlin') = 'ok', 'move: to a free hour the same day');
select pg_temp.check((select starts_at = ((select day from fx3) + time '13:00') at time zone 'Europe/Berlin' and rescheduled_from = ((select day from fx3) + time '09:00') at time zone 'Europe/Berlin' from public.sessions where id = (select id from mv)), 'move: new time stored, original kept for the Guide');
select pg_temp.check((select blocked_range = tstzrange(starts_at - interval '45 min', ends_at + interval '45 min', '[)') from public.sessions where id = (select id from mv)), 'move: buffers follow the session');
select pg_temp.check((select unlocks_at - (select ends_at from public.sessions where id = (select id from mv)) from public.my_letters()) = interval '48 hours', 'move: letter re-sealed to 48h after the new end');
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '13:30') at time zone 'Europe/Berlin') = 'ok', 'move: overlapping only its own old span is fine');
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '13:10') at time zone 'Europe/Berlin') = 'off_grid', 'move: same rules as booking (grid)');
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) - extract(dow from (select day from fx3))::int + 7 + time '10:00') at time zone 'Europe/Berlin') = 'outside_availability', 'move: same rules as booking (availability)');
select pg_temp.check(pg_temp.try_move((select id from mv), now() + interval '2 hours') = 'too_soon', 'move: same rules as booking (notice)');
reset role;
-- Someone else holds 10:00 the next open day; moving onto its stillness is refused.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
select pg_temp.check(pg_temp.try_book('10000000-0000-4000-8000-000000000002', ((select day from fx3) + time '09:00') at time zone 'Europe/Berlin', 'solo', null) = 'ok', 'move: another client takes the old hour');
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000cccc';
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '11:00') at time zone 'Europe/Berlin') = 'slot_taken', 'move: onto another session''s stillness → slot_taken');
select pg_temp.check((select starts_at = ((select day from fx3) + time '13:30') at time zone 'Europe/Berlin' from public.sessions where id = (select id from mv)), 'move: a refused move changes nothing');
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '14:00') at time zone 'Europe/Berlin') = 'not_reschedulable', 'move: nobody moves someone else''s session');
reset role;
update public.sessions set starts_at = now() + interval '20 hours', ends_at = now() + interval '21 hours 30 minutes' where id = (select id from mv);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000cccc';
select pg_temp.check(pg_temp.try_move((select id from mv), ((select day from fx3) + time '14:00') at time zone 'Europe/Berlin') = 'too_late', 'move: within 24h of the session → too_late');
reset role;
do $$ begin
  set local role anon;
  perform public.reschedule_session(gen_random_uuid(), now() + interval '3 days');
  raise exception 'FAIL: anon rescheduled';
exception when insufficient_privilege then raise notice 'ok  move: guests cannot call it';
end $$;

-- Guides may edit only their own availability.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b1';
update public.availability_rules set end_local = '17:00' where guide_id = '10000000-0000-4000-8000-000000000002';
reset role;
select pg_temp.check((select bool_and(end_local = '16:00') from public.availability_rules where guide_id = '10000000-0000-4000-8000-000000000002'), 'guide: cannot touch another Guide''s availability');

-- The exclusion constraint holds even for direct writes.
do $$ begin
  insert into public.sessions (client_id, guide_id, session_type, starts_at, ends_at, client_name, client_timezone)
  select client_id, guide_id, session_type, starts_at + interval '30 minutes', ends_at + interval '30 minutes', 'x', 'UTC'
  from public.sessions where status = 'held' limit 1;
  raise exception 'FAIL: overlapping insert accepted';
exception when exclusion_violation then raise notice 'ok  constraint: overlapping buffers rejected at the table';
end $$;

\o
\echo 'All Threshold database tests passed.'
