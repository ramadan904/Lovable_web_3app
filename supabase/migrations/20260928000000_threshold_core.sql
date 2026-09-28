-- ============================================================================
-- Threshold — core schema
--
-- An appointment platform for irreversible life thresholds.
-- Design principles encoded here, not just in the UI:
--   * Buffers are structural. Every session reserves 45 minutes before and
--     after itself, and an exclusion constraint makes overlap impossible.
--   * Scarcity is structural. Guides hold a small number of sessions a day.
--   * The future-self letter is sealed at the row level until 48 hours after
--     the session ends. Guides can never read it.
--   * Guests may browse everything needed to begin the ritual; only the final
--     act of holding a time requires an account.
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.presence_type as enum ('still', 'steady', 'direct', 'tender');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_type as enum ('solo', 'witnessed', 'aftermath');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_status as enum ('held', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('client', 'guide');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Users (profile rows mirror auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone     text,
  role         public.app_role not null default 'client',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Thresholds — the moments we hold
-- ---------------------------------------------------------------------------
create table if not exists public.thresholds (
  slug        text primary key,
  name        text not null,
  line        text not null,
  keywords    text[] not null default '{}',
  sort_order  smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Session forms — duration lives in data, not in the client
-- ---------------------------------------------------------------------------
create table if not exists public.session_types (
  key           public.session_type primary key,
  name          text not null,
  duration_min  smallint not null check (duration_min between 30 and 240),
  line          text not null,
  sort_order    smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------
create table if not exists public.guides (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users (id) on delete set null,
  slug                  text unique not null,
  name                  text not null,
  pronouns              text,
  presence              public.presence_type not null,
  statement             text not null,          -- in their own words
  background            text not null,
  location              text not null,
  timezone              text not null,           -- IANA zone, e.g. Europe/Lisbon
  years_holding         smallint not null default 1,
  tags                  text[] not null default '{}',
  languages             text[] not null default '{English}',
  max_sessions_per_day  smallint not null default 2 check (max_sessions_per_day between 1 and 4),
  buffer_min            smallint not null default 45 check (buffer_min >= 45),
  accepting             boolean not null default true,
  created_at            timestamptz not null default now()
);

create table if not exists public.guide_thresholds (
  guide_id        uuid not null references public.guides (id) on delete cascade,
  threshold_slug  text not null references public.thresholds (slug) on delete cascade,
  primary key (guide_id, threshold_slug)
);

-- Weekly availability in the Guide's own local time.
create table if not exists public.availability_rules (
  id           uuid primary key default gen_random_uuid(),
  guide_id     uuid not null references public.guides (id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_local  time not null,
  end_local    time not null,
  check (end_local > start_local)
);
create index if not exists availability_rules_guide_idx on public.availability_rules (guide_id, weekday);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references auth.users (id) on delete cascade,
  guide_id          uuid not null references public.guides (id) on delete restrict,
  threshold_slug    text references public.thresholds (slug),
  threshold_words   text,                        -- the client's own description
  session_type      public.session_type not null,
  status            public.session_status not null default 'held',
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  buffer_before_min smallint not null default 45 check (buffer_before_min >= 45),
  buffer_after_min  smallint not null default 45 check (buffer_after_min >= 45),
  -- [starts_at - buffer_before, ends_at + buffer_after), maintained by trigger
  blocked_range     tstzrange not null,
  client_name       text not null,
  client_timezone   text not null,
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  check (ends_at > starts_at),
  -- No two held sessions of one Guide may touch each other's buffers.
  constraint sessions_no_overlap exclude using gist (
    guide_id with =,
    blocked_range with &&
  ) where (status <> 'cancelled')
);
create index if not exists sessions_client_idx on public.sessions (client_id, starts_at);
create index if not exists sessions_guide_idx  on public.sessions (guide_id, starts_at);

create or replace function public.sessions_set_blocked_range()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.blocked_range := tstzrange(
    new.starts_at - make_interval(mins => new.buffer_before_min),
    new.ends_at   + make_interval(mins => new.buffer_after_min),
    '[)'
  );
  return new;
end $$;

drop trigger if exists sessions_blocked_range on public.sessions;
create trigger sessions_blocked_range
  before insert or update of starts_at, ends_at, buffer_before_min, buffer_after_min
  on public.sessions
  for each row execute function public.sessions_set_blocked_range();

-- ---------------------------------------------------------------------------
-- Reflective answers (session context for the Guide)
-- ---------------------------------------------------------------------------
create table if not exists public.reflective_answers (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  client_id     uuid not null references auth.users (id) on delete cascade,
  position      smallint not null check (position between 1 and 3),
  prompt        text not null,
  answer        text,                            -- null: "I'll bring this into the room"
  unique (session_id, position)
);

-- ---------------------------------------------------------------------------
-- Future-self letters (time-locked)
-- ---------------------------------------------------------------------------
create table if not exists public.future_self_letters (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references public.sessions (id) on delete cascade,
  client_id   uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 8000),
  unlocks_at  timestamptz not null,
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists letters_client_idx on public.future_self_letters (client_id);

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.thresholds          enable row level security;
alter table public.session_types       enable row level security;
alter table public.guides              enable row level security;
alter table public.guide_thresholds    enable row level security;
alter table public.availability_rules  enable row level security;
alter table public.sessions            enable row level security;
alter table public.reflective_answers  enable row level security;
alter table public.future_self_letters enable row level security;

-- Is the signed-in user the Guide behind guide_id?
create or replace function public.is_guide_of(p_guide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.guides g where g.id = p_guide_id and g.user_id = auth.uid());
$$;

-- Profiles: yours alone.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Nobody promotes themselves to Guide: only these columns are writable by users.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;

-- Catalogue: open to guests so the ritual can begin before an account exists.
drop policy if exists "thresholds: public read" on public.thresholds;
create policy "thresholds: public read" on public.thresholds
  for select to anon, authenticated using (true);
drop policy if exists "session_types: public read" on public.session_types;
create policy "session_types: public read" on public.session_types
  for select to anon, authenticated using (true);
drop policy if exists "guides: public read" on public.guides;
create policy "guides: public read" on public.guides
  for select to anon, authenticated using (accepting or user_id = auth.uid());
drop policy if exists "guide_thresholds: public read" on public.guide_thresholds;
create policy "guide_thresholds: public read" on public.guide_thresholds
  for select to anon, authenticated using (true);
drop policy if exists "availability: public read" on public.availability_rules;
create policy "availability: public read" on public.availability_rules
  for select to anon, authenticated using (true);

-- Guides maintain their own availability (and nothing else about themselves here).
drop policy if exists "availability: guide writes own" on public.availability_rules;
create policy "availability: guide writes own" on public.availability_rules
  for all to authenticated
  using (public.is_guide_of(guide_id))
  with check (public.is_guide_of(guide_id));

-- Sessions: the client and their Guide. Writes only through the RPCs below.
drop policy if exists "sessions: client or guide reads" on public.sessions;
create policy "sessions: client or guide reads" on public.sessions
  for select to authenticated
  using (client_id = auth.uid() or public.is_guide_of(guide_id));

-- Reflective answers: the client who wrote them and the Guide who will hold them.
drop policy if exists "answers: client or guide reads" on public.reflective_answers;
create policy "answers: client or guide reads" on public.reflective_answers
  for select to authenticated
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = reflective_answers.session_id and public.is_guide_of(s.guide_id)
    )
  );

-- Letters: only the author, and only once the seal has lifted.
-- There is deliberately no Guide policy. Sealed metadata is served by my_letters().
drop policy if exists "letters: author reads once unsealed" on public.future_self_letters;
create policy "letters: author reads once unsealed" on public.future_self_letters
  for select to authenticated
  using (client_id = auth.uid() and unlocks_at <= now());

-- ============================================================================
-- Functions
-- ============================================================================

-- New auth user -> profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'timezone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Busy time for a Guide, stripped of every detail but the time itself.
-- Guests call this while choosing a time; nobody learns who is booked.
create or replace function public.guide_busy_ranges(p_guide_id uuid, p_from timestamptz, p_to timestamptz)
returns table (blocked_start timestamptz, blocked_end timestamptz, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select lower(s.blocked_range), upper(s.blocked_range), s.starts_at, s.ends_at
  from public.sessions s
  where s.guide_id = p_guide_id
    and s.status <> 'cancelled'
    and s.blocked_range && tstzrange(p_from, p_to, '[)')
  order by 1;
$$;

-- The heart of the ritual: hold a time, atomically.
-- Raises one of: auth_required, guide_unavailable, unknown_form, too_soon, too_far,
-- off_grid, outside_availability, day_full, client_overlap, slot_taken.
create or replace function public.book_session(
  p_guide_id        uuid,
  p_threshold_slug  text,
  p_threshold_words text,
  p_session_type    public.session_type,
  p_starts_at       timestamptz,
  p_client_name     text,
  p_client_timezone text,
  p_answers         jsonb,           -- [{ "position": 1, "prompt": "...", "answer": "..." | null }]
  p_letter          text             -- null or empty: no letter
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_guide       public.guides%rowtype;
  v_duration    smallint;
  v_ends_at     timestamptz;
  v_block_start timestamptz;
  v_block_end   timestamptz;
  v_local_start timestamp;
  v_local_end   timestamp;
  v_day_count   int;
  v_session_id  uuid;
  v_answer      jsonb;
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

  if p_starts_at < now() + interval '24 hours' then
    raise exception 'too_soon';
  end if;
  if p_starts_at > now() + interval '60 days' then
    raise exception 'too_far';
  end if;
  if extract(second from p_starts_at) <> 0 or (extract(minute from p_starts_at)::int % 15) <> 0 then
    raise exception 'off_grid';
  end if;

  v_ends_at     := p_starts_at + make_interval(mins => v_duration);
  v_block_start := p_starts_at - make_interval(mins => v_guide.buffer_min);
  v_block_end   := v_ends_at + make_interval(mins => v_guide.buffer_min);
  v_local_start := v_block_start at time zone v_guide.timezone;
  v_local_end   := v_block_end at time zone v_guide.timezone;

  -- The whole held span, buffers included, must sit inside one availability window.
  if v_local_start::date <> v_local_end::date or not exists (
    select 1 from public.availability_rules r
    where r.guide_id = v_guide.id
      and r.weekday = extract(dow from v_local_start)::int
      and r.start_local <= v_local_start::time
      and r.end_local >= v_local_end::time
  ) then
    raise exception 'outside_availability';
  end if;

  -- An exact clash is reported as such; the exclusion constraint below remains the backstop for races.
  if exists (
    select 1 from public.sessions s
    where s.guide_id = v_guide.id
      and s.status <> 'cancelled'
      and s.blocked_range && tstzrange(v_block_start, v_block_end, '[)')
  ) then
    raise exception 'slot_taken';
  end if;

  select count(*) into v_day_count
  from public.sessions s
  where s.guide_id = v_guide.id
    and s.status <> 'cancelled'
    and (s.starts_at at time zone v_guide.timezone)::date = (p_starts_at at time zone v_guide.timezone)::date;
  if v_day_count >= v_guide.max_sessions_per_day then
    raise exception 'day_full';
  end if;

  if exists (
    select 1 from public.sessions s
    where s.client_id = v_uid
      and s.status <> 'cancelled'
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'client_overlap';
  end if;

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

-- Release a held time. The letter is returned to its author, unopened.
create or replace function public.cancel_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
     set status = 'cancelled', cancelled_at = now()
   where id = p_session_id
     and client_id = auth.uid()
     and status = 'held'
     and starts_at > now();
  if not found then
    raise exception 'not_cancellable';
  end if;

  update public.future_self_letters
     set unlocks_at = now()
   where session_id = p_session_id and client_id = auth.uid();
end $$;

-- Letter envelopes for the signed-in author. The body is present only once unsealed.
create or replace function public.my_letters()
returns table (
  id uuid, session_id uuid, unlocks_at timestamptz, opened_at timestamptz,
  created_at timestamptz, word_count int, is_open boolean, body text
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.session_id, l.unlocks_at, l.opened_at, l.created_at,
         coalesce(array_length(regexp_split_to_array(trim(l.body), '\s+'), 1), 0),
         l.unlocks_at <= now(),
         case when l.unlocks_at <= now() then l.body end
  from public.future_self_letters l
  where l.client_id = auth.uid()
  order by l.unlocks_at;
$$;

create or replace function public.open_letter(p_letter_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.future_self_letters
     set opened_at = coalesce(opened_at, now())
   where id = p_letter_id and client_id = auth.uid() and unlocks_at <= now();
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.book_session(uuid, text, text, public.session_type, timestamptz, text, text, jsonb, text) from public, anon;
revoke all on function public.cancel_session(uuid) from public, anon;
revoke all on function public.my_letters() from public, anon;
revoke all on function public.open_letter(uuid) from public, anon;

grant execute on function public.guide_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_session(uuid, text, text, public.session_type, timestamptz, text, text, jsonb, text) to authenticated;
grant execute on function public.cancel_session(uuid) to authenticated;
grant execute on function public.my_letters() to authenticated;
grant execute on function public.open_letter(uuid) to authenticated;
