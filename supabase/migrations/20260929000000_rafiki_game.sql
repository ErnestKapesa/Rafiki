-- Rafiki game backend ---------------------------------------------------------
-- Profiles, expeditions, discoveries, quizzes, badges, wardrobe and daily
-- quests. Every reward is computed here inside SECURITY DEFINER functions so
-- clients can read their own rows but can never write XP/stardust directly.
-- Numbers mirror shared/game.ts (checked by tests/sql/parity.test.ts).

create extension if not exists pgcrypto;

-- ─── Catalog tables (public read) ───────────────────────────────────────────
create table public.shop_items (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('hat','neck','face','color','species')),
  price int not null check (price >= 0),
  min_level int not null default 1
);

insert into public.shop_items (id, name, kind, price, min_level) values
  ('scarf','Cozy scarf','neck',0,1),
  ('bow','Bow tie','neck',40,1),
  ('beanie','Beanie','hat',30,1),
  ('flower','Hibiscus','hat',40,1),
  ('headphones','Headphones','hat',60,2),
  ('tophat','Top hat','hat',80,3),
  ('grad','Scholar cap','hat',100,4),
  ('crown','Crown','hat',150,5),
  ('glasses','Reading glasses','face',50,1),
  ('shades','Cool shades','face',70,2),
  ('coral','Coral fur','color',50,1),
  ('midnight','Midnight fur','color',120,3),
  ('unicorn','Unicorn horn','species',100,4);

create table public.quest_defs (
  ord int primary key, -- position in QUEST_POOL (order matters for the daily pick)
  id text unique not null,
  counter text not null,
  goal int not null
);

insert into public.quest_defs (ord, id, counter, goal) values
  (0,'explore_3','explorations',3),
  (1,'deep_1','deepDives',1),
  (2,'discover_3','discoveries',3),
  (3,'quiz_2','quizCorrect',2),
  (4,'voice_1','voiceQuestions',1),
  (5,'news_1','newsExplorations',1),
  (6,'trail_2','trail',2);

-- ─── Player tables ──────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Explorer' check (char_length(display_name) between 1 and 32),
  friend_name text not null default 'Rafiki' check (char_length(friend_name) between 1 and 24),
  character jsonb not null default
    '{"species":"bear","color":"peach","eyes":"round","pattern":"belly","hat":null,"neck":"scarf","face":null}',
  xp int not null default 0,
  stardust int not null default 20,
  streak int not null default 0,
  best_streak int not null default 0,
  last_active date,
  trail int not null default 0,
  best_trail int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.explorations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  question text not null check (char_length(question) between 1 and 1000),
  mode text not null check (mode in ('quick','deep')),
  topic text not null default 'general' check (topic in ('general','news')),
  emoji text,
  source_count int not null default 0,
  via_voice boolean not null default false,
  parent_id uuid references public.explorations on delete set null,
  trail_depth int not null default 0,
  local_hour int check (local_hour between 0 and 23),
  created_at timestamptz not null default now()
);
create index explorations_user_created on public.explorations (user_id, created_at desc);

create table public.discoveries (
  user_id uuid not null references public.profiles on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 2048),
  domain text not null,
  exploration_id uuid references public.explorations on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, url)
);

create table public.quiz_attempts (
  user_id uuid not null references public.profiles on delete cascade,
  exploration_id uuid not null references public.explorations on delete cascade,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, exploration_id)
);

create table public.achievements (
  user_id uuid not null references public.profiles on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);

create table public.inventory (
  user_id uuid not null references public.profiles on delete cascade,
  item text not null references public.shop_items,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item)
);

create table public.quest_claims (
  user_id uuid not null references public.profiles on delete cascade,
  quest_id text not null references public.quest_defs (id),
  day date not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, quest_id, day)
);

-- ─── Row level security: read your own rows, write only through RPCs ────────
alter table public.profiles enable row level security;
alter table public.explorations enable row level security;
alter table public.discoveries enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.achievements enable row level security;
alter table public.inventory enable row level security;
alter table public.quest_claims enable row level security;
alter table public.shop_items enable row level security;
alter table public.quest_defs enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "own explorations" on public.explorations for select using (user_id = auth.uid());
create policy "own discoveries" on public.discoveries for select using (user_id = auth.uid());
create policy "own quizzes" on public.quiz_attempts for select using (user_id = auth.uid());
create policy "own badges" on public.achievements for select using (user_id = auth.uid());
create policy "own inventory" on public.inventory for select using (user_id = auth.uid());
create policy "own quest claims" on public.quest_claims for select using (user_id = auth.uid());
create policy "catalog" on public.shop_items for select using (true);
create policy "quest catalog" on public.quest_defs for select using (true);

-- ─── New user → profile + starter kit ───────────────────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.inventory (user_id, item) values (new.id, 'scarf') on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Helpers ────────────────────────────────────────────────────────────────
create function public.xp_for_level(p_level int) returns int
language sql immutable as $$ select 50 * p_level * (p_level - 1) $$;

create function public.level_for(p_xp int) returns int
language plpgsql immutable as $$
declare l int := 1;
begin
  while p_xp >= public.xp_for_level(l + 1) loop l := l + 1; end loop;
  return l;
end $$;

create function public.domain_of(p_url text) returns text
language sql immutable as $$
  select lower(substring(p_url from '^https?://(?:www\.)?([^/:?#]+)'))
$$;

create function public._uid() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return u;
end $$;

create function public._stats(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'explorations', (select count(*) from explorations where user_id = p_uid),
    'deepDives', (select count(*) from explorations where user_id = p_uid and mode = 'deep'),
    'voiceQuestions', (select count(*) from explorations where user_id = p_uid and via_voice),
    'newsExplorations', (select count(*) from explorations where user_id = p_uid and topic = 'news'),
    'quizCorrect', (select count(*) from quiz_attempts where user_id = p_uid and correct),
    'discoveries', (select count(*) from discoveries where user_id = p_uid),
    'domains', (select count(distinct domain) from discoveries where user_id = p_uid),
    'bestTrail', (select best_trail from profiles where id = p_uid),
    'bestStreak', (select best_streak from profiles where id = p_uid),
    'nightOwl', (select count(*) from explorations where user_id = p_uid and local_hour between 0 and 4)
  )
$$;

-- Badge thresholds mirror BADGES in shared/game.ts.
create function public._award_badges(p_uid uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public._stats(p_uid);
  earned text[];
begin
  with rules(badge, stat, goal) as (values
    ('first_steps','explorations',1), ('curious_cat','explorations',10),
    ('deep_diver','deepDives',3), ('chatterbox','voiceQuestions',3),
    ('quiz_whiz','quizCorrect',5), ('globetrotter','domains',15),
    ('on_fire','bestStreak',3), ('night_owl','nightOwl',1),
    ('trailblazer','bestTrail',3), ('news_hound','newsExplorations',3)
  ), ins as (
    insert into achievements (user_id, badge)
    select p_uid, badge from rules where (s ->> stat)::int >= goal
    on conflict do nothing
    returning badge
  )
  select coalesce(array_agg(badge), '{}') into earned from ins;
  return earned;
end $$;

create function public._result(p_uid uuid, p_xp int, p_stardust int, p_badges text[], p_extra jsonb default '{}')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'xp', p.xp, 'stardust', p.stardust, 'level', public.level_for(p.xp),
    'streak', p.streak, 'bestStreak', p.best_streak, 'trail', p.trail,
    'gained', jsonb_build_object('xp', p_xp, 'stardust', p_stardust),
    'newBadges', to_jsonb(p_badges)
  ) || p_extra
  from profiles p where p.id = p_uid
$$;

-- ─── RPC: finished an expedition ────────────────────────────────────────────
create function public.record_exploration(
  p_question text, p_mode text, p_topic text, p_emoji text,
  p_source_count int, p_via_voice boolean, p_parent uuid, p_local_hour int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  p profiles;
  today date := (now() at time zone 'utc')::date;
  new_streak int;
  streak_bonus int := 0;
  depth int := 0;
  gx int; gs int;
  new_id uuid;
begin
  select * into p from profiles where id = uid for update;
  if exists (select 1 from explorations where user_id = uid and created_at > now() - interval '3 seconds') then
    raise exception 'slow down, explorer' using errcode = 'P0001';
  end if;

  -- streak: first expedition of a new day
  if p.last_active is distinct from today then
    new_streak := case when p.last_active = today - 1 then p.streak + 1 else 1 end;
    streak_bonus := 10 * least(new_streak, 7);
  else
    new_streak := p.streak;
  end if;

  -- trail: follow-up of one of *your* expeditions
  if p_parent is not null and exists (select 1 from explorations where id = p_parent and user_id = uid) then
    depth := (select trail_depth from explorations where id = p_parent) + 1;
  end if;

  gx := case when p_mode = 'deep' then 40 else 20 end
      + case when p_via_voice then 5 else 0 end
      + 5 * least(depth, 5);
  gs := case when p_mode = 'deep' then 10 else 5 end + streak_bonus;

  insert into explorations (user_id, question, mode, topic, emoji, source_count, via_voice, parent_id, trail_depth, local_hour)
  values (uid, left(p_question, 1000), p_mode, coalesce(p_topic, 'general'), p_emoji, greatest(p_source_count, 0),
          coalesce(p_via_voice, false), case when depth > 0 then p_parent end, depth, p_local_hour)
  returning id into new_id;

  update profiles set
    xp = xp + gx, stardust = stardust + gs,
    streak = new_streak, best_streak = greatest(best_streak, new_streak), last_active = today,
    trail = depth, best_trail = greatest(best_trail, depth), updated_at = now()
  where id = uid;

  return public._result(uid, gx, gs, public._award_badges(uid),
    jsonb_build_object('explorationId', new_id, 'streakBonus', streak_bonus, 'trailDepth', depth));
end $$;

-- ─── RPC: opened a source ("discovered a world") ────────────────────────────
create function public.record_discovery(p_url text, p_exploration uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  d text := public.domain_of(p_url);
  new_domain boolean;
  inserted int;
  gx int := 0; gs int := 0;
begin
  if d is null then raise exception 'invalid url'; end if;
  new_domain := not exists (select 1 from discoveries where user_id = uid and domain = d);
  insert into discoveries (user_id, url, domain, exploration_id)
  values (uid, p_url, d, (select id from explorations where id = p_exploration and user_id = uid))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    gx := 5; gs := 2 + case when new_domain then 10 else 0 end;
    update profiles set xp = xp + gx, stardust = stardust + gs, updated_at = now() where id = uid;
  end if;
  return public._result(uid, gx, gs, public._award_badges(uid),
    jsonb_build_object('newWorld', inserted = 1 and new_domain));
end $$;

-- ─── RPC: answered the pop quiz (one attempt per expedition) ────────────────
create function public.record_quiz(p_exploration uuid, p_correct boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  inserted int;
  gx int := 0; gs int := 0;
begin
  if not exists (select 1 from explorations where id = p_exploration and user_id = uid) then
    raise exception 'unknown expedition';
  end if;
  insert into quiz_attempts (user_id, exploration_id, correct) values (uid, p_exploration, p_correct)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    gx := case when p_correct then 15 else 3 end;
    gs := case when p_correct then 5 else 0 end;
    update profiles set xp = xp + gx, stardust = stardust + gs, updated_at = now() where id = uid;
  end if;
  return public._result(uid, gx, gs, public._award_badges(uid));
end $$;

-- ─── Daily quests ───────────────────────────────────────────────────────────
-- Same deterministic pick as questsForDate() in shared/game.ts (uint32 math).
create function public.quests_for_date(p_day date) returns setof text
language plpgsql immutable as $$
declare
  s text := to_char(p_day, 'YYYY-MM-DD');
  h bigint := 0;
  pool text[] := array['explore_3','deep_1','discover_3','quiz_2','voice_1','news_1','trail_2'];
  idx int;
  i int;
  ch int;
begin
  for i in 1..length(s) loop
    ch := ascii(substr(s, i, 1));
    h := (h * 31 + ch) % 4294967296;
  end loop;
  for i in 1..3 loop
    h := (h * 1103515245 + 12345) % 4294967296;
    idx := (h % array_length(pool, 1))::int + 1;
    return next pool[idx];
    pool := pool[1:idx - 1] || pool[idx + 1:];
  end loop;
end $$;

create function public._quest_progress(p_uid uuid, p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  with e as (select * from explorations where user_id = p_uid and (created_at at time zone 'utc')::date = p_day)
  select jsonb_build_object(
    'explorations', (select count(*) from e),
    'deepDives', (select count(*) from e where mode = 'deep'),
    'voiceQuestions', (select count(*) from e where via_voice),
    'newsExplorations', (select count(*) from e where topic = 'news'),
    'trail', (select coalesce(max(trail_depth), 0) from e),
    'discoveries', (select count(*) from discoveries where user_id = p_uid and (created_at at time zone 'utc')::date = p_day),
    'quizCorrect', (select count(*) from quiz_attempts where user_id = p_uid and correct and (created_at at time zone 'utc')::date = p_day)
  )
$$;

create function public.claim_daily_quest(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  today date := (now() at time zone 'utc')::date;
  q quest_defs;
  progress jsonb := public._quest_progress(uid, today);
begin
  if p_quest not in (select public.quests_for_date(today)) then raise exception 'not today''s quest'; end if;
  select * into q from quest_defs where id = p_quest;
  if (progress ->> q.counter)::int < q.goal then raise exception 'quest not complete yet'; end if;
  insert into quest_claims (user_id, quest_id, day) values (uid, p_quest, today);
  update profiles set xp = xp + 30, stardust = stardust + 15, updated_at = now() where id = uid;
  return public._result(uid, 30, 15, public._award_badges(uid));
exception when unique_violation then
  raise exception 'already claimed';
end $$;

-- ─── Wardrobe ───────────────────────────────────────────────────────────────
create function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  it shop_items;
  p profiles;
begin
  select * into it from shop_items where id = p_item;
  if not found then raise exception 'no such item'; end if;
  select * into p from profiles where id = uid for update;
  if exists (select 1 from inventory where user_id = uid and item = p_item) then raise exception 'already owned'; end if;
  if public.level_for(p.xp) < it.min_level then raise exception 'reach level % first', it.min_level; end if;
  if p.stardust < it.price then raise exception 'not enough stardust'; end if;
  update profiles set stardust = stardust - it.price, updated_at = now() where id = uid;
  insert into inventory (user_id, item) values (uid, p_item);
  return public._result(uid, 0, -it.price, '{}');
end $$;

create function public.save_character(p_character jsonb, p_display_name text, p_friend_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  owned text[] := array(select item from inventory where user_id = uid);
  free_colors text[] := array['peach','lilac','mint','sky','butter','rose'];
  free_species text[] := array['bear','bunny','cat','sprout','antenna'];
  slot text;
begin
  if not ((p_character ->> 'color') = any(free_colors || owned)) then raise exception 'color not owned'; end if;
  if not ((p_character ->> 'species') = any(free_species || owned)) then raise exception 'species not owned'; end if;
  if (p_character ->> 'eyes') not in ('round','sparkle','sleepy') then raise exception 'bad eyes'; end if;
  if (p_character ->> 'pattern') not in ('belly','spots','none') then raise exception 'bad pattern'; end if;
  foreach slot in array array['hat','neck','face'] loop
    if jsonb_typeof(p_character -> slot) = 'string' and not ((p_character ->> slot) = any(owned)) then
      raise exception '% not owned', p_character ->> slot;
    end if;
  end loop;
  update profiles set
    character = jsonb_build_object(
      'species', p_character -> 'species', 'color', p_character -> 'color', 'eyes', p_character -> 'eyes',
      'pattern', p_character -> 'pattern', 'hat', p_character -> 'hat', 'neck', p_character -> 'neck', 'face', p_character -> 'face'),
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    friend_name = coalesce(nullif(trim(p_friend_name), ''), friend_name),
    updated_at = now()
  where id = uid;
end $$;

-- ─── Reads ──────────────────────────────────────────────────────────────────
create function public.get_my_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  today date := (now() at time zone 'utc')::date;
begin
  insert into profiles (id) values (uid) on conflict do nothing; -- users created before the trigger existed
  insert into inventory (user_id, item) values (uid, 'scarf') on conflict do nothing;
  return (
    select jsonb_build_object(
      'profile', to_jsonb(p) - 'id',
      'level', public.level_for(p.xp),
      'stats', public._stats(uid),
      'badges', coalesce((select jsonb_agg(badge) from achievements where user_id = uid), '[]'),
      'inventory', coalesce((select jsonb_agg(item) from inventory where user_id = uid), '[]'),
      'quests', (select jsonb_agg(q) from public.quests_for_date(today) q),
      'questProgress', public._quest_progress(uid, today),
      'questClaims', coalesce((select jsonb_agg(quest_id) from quest_claims where user_id = uid and day = today), '[]'),
      'domains', coalesce((select jsonb_agg(distinct domain) from discoveries where user_id = uid), '[]')
    ) from profiles p where p.id = uid
  );
end $$;

create function public.get_leaderboard(p_limit int default 20)
returns table (rank bigint, display_name text, friend_name text, avatar jsonb, xp int, level int, streak int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by xp desc, created_at), display_name, friend_name, character, xp,
         public.level_for(xp), streak, id = auth.uid()
  from profiles order by xp desc, created_at limit least(greatest(p_limit, 1), 100)
$$;

-- Only expose the RPCs, not the internal helpers.
revoke all on function public._stats, public._award_badges, public._result, public._quest_progress, public.handle_new_user from public, anon, authenticated;
revoke all on function public.record_exploration, public.record_discovery, public.record_quiz, public.claim_daily_quest,
  public.buy_item, public.save_character, public.get_my_state from public, anon;
grant execute on function public.record_exploration, public.record_discovery, public.record_quiz, public.claim_daily_quest,
  public.buy_item, public.save_character, public.get_my_state to authenticated;
grant execute on function public.get_leaderboard to anon, authenticated;
