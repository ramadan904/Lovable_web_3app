-- ============================================================================
-- Threshold — self-serve rescheduling
--
-- A client can move their own session without writing to their Guide.
-- Moving obeys exactly the same rules as booking (one shared validator), keeps
-- the answers, re-seals the letter to the new time, and leaves the Guide a
-- quiet note of where the session came from. Nothing for the owner to do.
-- ============================================================================

alter table public.sessions
  add column if not exists rescheduled_from timestamptz,
  add column if not exists rescheduled_at   timestamptz;

-- ---------------------------------------------------------------------------
-- The one validator, shared by booking and rescheduling.
-- Raises: too_soon, too_far, off_grid, outside_availability, slot_taken,
--         day_full, client_overlap. The session being moved is ignored.
-- ---------------------------------------------------------------------------
create or replace function public.assert_slot_open(
  p_guide     public.guides,
  p_starts_at timestamptz,
  p_duration  int,
  p_client    uuid,
  p_exclude   uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ends_at     timestamptz := p_starts_at + make_interval(mins => p_duration);
  v_block_start timestamptz := p_starts_at - make_interval(mins => p_guide.buffer_min);
  v_block_end   timestamptz := p_starts_at + make_interval(mins => p_duration + p_guide.buffer_min);
  v_local_start timestamp   := v_block_start at time zone p_guide.timezone;
  v_local_end   timestamp   := v_block_end at time zone p_guide.timezone;
  v_day_count   int;
begin
  if p_starts_at < now() + interval '24 hours' then
    raise exception 'too_soon';
  end if;
  if p_starts_at > now() + interval '60 days' then
    raise exception 'too_far';
  end if;
  if extract(second from p_starts_at) <> 0 or (extract(minute from p_starts_at)::int % 15) <> 0 then
    raise exception 'off_grid';
  end if;

  -- The whole held span, buffers included, must sit inside one availability window.
  if v_local_start::date <> v_local_end::date or not exists (
    select 1 from public.availability_rules r
    where r.guide_id = p_guide.id
      and r.weekday = extract(dow from v_local_start)::int
      and r.start_local <= v_local_start::time
      and r.end_local >= v_local_end::time
  ) then
    raise exception 'outside_availability';
  end if;

  -- An exact clash is reported as such; the exclusion constraint remains the backstop for races.
  if exists (
    select 1 from public.sessions s
    where s.guide_id = p_guide.id
      and s.status <> 'cancelled'
      and s.id is distinct from p_exclude
      and s.blocked_range && tstzrange(v_block_start, v_block_end, '[)')
  ) then
    raise exception 'slot_taken';
  end if;

  select count(*) into v_day_count
  from public.sessions s
  where s.guide_id = p_guide.id
    and s.status <> 'cancelled'
    and s.id is distinct from p_exclude
    and (s.starts_at at time zone p_guide.timezone)::date = (p_starts_at at time zone p_guide.timezone)::date;
  if v_day_count >= p_guide.max_sessions_per_day then
    raise exception 'day_full';
  end if;

  if exists (
    select 1 from public.sessions s
    where s.client_id = p_client
      and s.status <> 'cancelled'
      and s.id is distinct from p_exclude
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'client_overlap';
  end if;
end $$;

revoke all on function public.assert_slot_open(public.guides, timestamptz, int, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking, now built on the shared validator (behaviour unchanged).
-- ---------------------------------------------------------------------------
create or replace function public.book_session(
  p_guide_id        uuid,
  p_threshold_slug  text,
  p_threshold_words text,
  p_session_type    public.session_type,
  p_starts_at       timestamptz,
  p_client_name     text,
  p_client_timezone text,
  p_answers         jsonb,
  p_letter          text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_guide      public.guides%rowtype;
  v_duration   smallint;
  v_ends_at    timestamptz;
  v_session_id uuid;
  v_answer     jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  -- Serialise bookings per Guide so the daily limit cannot race.
  select * into v_guide from public.guides where id = p_guide_id for update;
  if not found or not v_guide.accepting then
    raise exception 'guide_unavailable';
  end if;

  select duration_min into v_duration from public.session_types where key = p_session_type;
  if v_duration is null then
    raise exception 'unknown_form';
  end if;

  perform public.assert_slot_open(v_guide, p_starts_at, v_duration, v_uid, null);
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  begin
    insert into public.sessions (
      client_id, guide_id, threshold_slug, threshold_words, session_type,
      starts_at, ends_at, buffer_before_min, buffer_after_min, client_name, client_timezone
    ) values (
      v_uid, v_guide.id, p_threshold_slug, nullif(trim(p_threshold_words), ''), p_session_type,
      p_starts_at, v_ends_at, v_guide.buffer_min, v_guide.buffer_min,
      coalesce(nullif(trim(p_client_name), ''), 'Unnamed'), p_client_timezone
    )
    returning id into v_session_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  for v_answer in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    insert into public.reflective_answers (session_id, client_id, position, prompt, answer)
    values (
      v_session_id, v_uid,
      (v_answer ->> 'position')::smallint,
      v_answer ->> 'prompt',
      nullif(trim(v_answer ->> 'answer'), '')
    );
  end loop;

  if p_letter is not null and length(trim(p_letter)) > 0 then
    insert into public.future_self_letters (session_id, client_id, body, unlocks_at)
    values (v_session_id, v_uid, p_letter, v_ends_at + interval '48 hours');
  end if;

  update public.profiles
     set display_name = coalesce(display_name, nullif(trim(p_client_name), '')),
         timezone = p_client_timezone
   where id = v_uid;

  return v_session_id;
end $$;

-- ---------------------------------------------------------------------------
-- Move a held session. Allowed until 24 hours before it begins — after that
-- the Guide is already preparing. Raises not_reschedulable, too_late, or any
-- validator error.
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_session(p_session_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_session  public.sessions%rowtype;
  v_guide    public.guides%rowtype;
  v_duration int;
  v_ends_at  timestamptz;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  select * into v_session from public.sessions
   where id = p_session_id and client_id = v_uid and status = 'held'
   for update;
  if not found then
    raise exception 'not_reschedulable';
  end if;
  if v_session.starts_at < now() + interval '24 hours' then
    raise exception 'too_late';
  end if;
  if p_starts_at = v_session.starts_at then
    return;
  end if;

  select * into v_guide from public.guides where id = v_session.guide_id for update;
  v_duration := extract(epoch from (v_session.ends_at - v_session.starts_at))::int / 60;

  perform public.assert_slot_open(v_guide, p_starts_at, v_duration, v_uid, v_session.id);
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  begin
    update public.sessions
       set starts_at = p_starts_at,
           ends_at = v_ends_at,
           rescheduled_from = coalesce(rescheduled_from, v_session.starts_at),
           rescheduled_at = now()
     where id = v_session.id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  -- The letter stays sealed, now until 48 hours after the new ending.
  update public.future_self_letters
     set unlocks_at = v_ends_at + interval '48 hours'
   where session_id = v_session.id and client_id = v_uid;
end $$;

revoke all on function public.reschedule_session(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_session(uuid, timestamptz) to authenticated;
