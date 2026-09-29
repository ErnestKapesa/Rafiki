-- Scenario test for the Rafiki game backend. Run with tests/sql/run.sh.
\set ON_ERROR_STOP on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

create or replace function pg_temp.expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error containing "%" from: %', needle, sql;
exception when others then
  if sqlerrm not ilike '%' || needle || '%' then raise; end if;
end $$;

-- starter kit
do $$ begin
  assert (select stardust from profiles where id = '00000000-0000-0000-0000-00000000000a') = 20, 'starting stardust';
  assert exists (select 1 from inventory where user_id = '00000000-0000-0000-0000-00000000000a' and item = 'scarf'), 'starter scarf';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- 1st expedition: 20 xp, 5 stardust + 10 streak bonus, first_steps badge
do $$ declare r jsonb := record_exploration('what is a quasar?', 'quick', 'general', '🔭', 5, false, null, 14);
begin
  assert (r->'gained'->>'xp')::int = 20, 'xp ' || r;
  assert (r->'gained'->>'stardust')::int = 15, 'stardust ' || r;
  assert (r->>'stardust')::int = 35 and (r->>'streak')::int = 1, r::text;
  assert r->'newBadges' ? 'first_steps', 'badge ' || r;
  perform set_config('test.e1', r->>'explorationId', false);
end $$;

-- rate limit
select pg_temp.expect_error($q$select record_exploration('again', 'quick', 'general', null, 1, false, null, 14)$q$, 'slow down');

reset role;
update explorations set created_at = created_at - interval '1 minute';
set role authenticated;

-- follow-up, deep, by voice at 2am: 40 + 5 voice + 5 trail = 50 xp, 10 stardust (no second streak bonus)
do $$ declare r jsonb := record_exploration('how far away?', 'deep', 'news', '🌌', 8, true, current_setting('test.e1')::uuid, 2);
begin
  assert (r->'gained'->>'xp')::int = 50, 'deep xp ' || r;
  assert (r->'gained'->>'stardust')::int = 10, 'deep sd ' || r;
  assert (r->>'trailDepth')::int = 1, 'trail ' || r;
  assert r->'newBadges' ? 'night_owl', 'night owl ' || r;
  assert (r->>'xp')::int = 70, 'total xp ' || r;
end $$;

-- discoveries: new world bonus once per domain, nothing for repeats
do $$ declare e uuid := current_setting('test.e1')::uuid; r jsonb;
begin
  r := record_discovery('https://www.example.com/a', e);
  assert (r->'gained'->>'xp')::int = 5 and (r->'gained'->>'stardust')::int = 12 and (r->>'newWorld')::boolean, 'd1 ' || r;
  r := record_discovery('https://www.example.com/a', e);
  assert (r->'gained'->>'xp')::int = 0, 'repeat ' || r;
  r := record_discovery('https://example.com/b', e);
  assert (r->'gained'->>'stardust')::int = 2 and not (r->>'newWorld')::boolean, 'same domain ' || r;
end $$;
select pg_temp.expect_error($q$select record_discovery('javascript:alert(1)', null)$q$, 'invalid url');

-- quiz: once per expedition
do $$ declare e uuid := current_setting('test.e1')::uuid; r jsonb;
begin
  r := record_quiz(e, true);
  assert (r->'gained'->>'xp')::int = 15 and (r->'gained'->>'stardust')::int = 5, 'quiz ' || r;
  r := record_quiz(e, true);
  assert (r->'gained'->>'xp')::int = 0, 'quiz twice ' || r;
  -- totals: xp 70 + 5 + 5 + 15 = 95 ; stardust 35 + 10 + 12 + 2 + 5 = 64
  assert (r->>'xp')::int = 95 and (r->>'stardust')::int = 64 and (r->>'level')::int = 1, 'totals ' || r;
end $$;

-- wardrobe
select pg_temp.expect_error($q$select buy_item('tophat')$q$, 'reach level 3');
select pg_temp.expect_error($q$select buy_item('scarf')$q$, 'already owned');
do $$ declare r jsonb := buy_item('beanie');
begin assert (r->>'stardust')::int = 34, 'after beanie ' || r; end $$;
select pg_temp.expect_error($q$select buy_item('crown')$q$, 'reach level 5');
select pg_temp.expect_error($q$select save_character('{"species":"bear","color":"peach","eyes":"round","pattern":"belly","hat":"crown","neck":null,"face":null}', 'Ernest', 'Rafi')$q$, 'not owned');
select pg_temp.expect_error($q$select save_character('{"species":"unicorn","color":"peach","eyes":"round","pattern":"belly","hat":null,"neck":null,"face":null}', 'Ernest', 'Rafi')$q$, 'species not owned');
select save_character('{"species":"bunny","color":"mint","eyes":"sparkle","pattern":"spots","hat":"beanie","neck":"scarf","face":null,"evil":"x"}', 'Ernest', 'Rafi');
do $$ begin
  assert (select character->>'hat' from profiles) = 'beanie', 'saved hat';
  assert not (select character ? 'evil' from profiles), 'unknown keys dropped';
  assert (select friend_name from profiles) = 'Rafi', 'friend name';
end $$;

-- clients cannot write rewards directly
select pg_temp.expect_error($q$update profiles set xp = 999999$q$, 'permission denied');
select pg_temp.expect_error($q$insert into explorations (user_id, question, mode) values (auth.uid(), 'x', 'quick')$q$, 'permission denied');
select pg_temp.expect_error($q$select _award_badges(auth.uid())$q$, 'permission denied');

-- daily quest: incomplete quests can't be claimed; someone else's day can't either
select pg_temp.expect_error($q$select claim_daily_quest('nope')$q$, 'not today');

-- state snapshot
do $$ declare s jsonb := get_my_state();
begin
  assert jsonb_array_length(s->'quests') = 3, 'three quests';
  assert (s->'stats'->>'domains')::int = 1 and (s->'stats'->>'explorations')::int = 2, 'stats ' || (s->'stats');
  assert (s->'questProgress'->>'trail')::int = 1, 'progress ' || (s->'questProgress');
end $$;

-- claim a quest whose goal is met, if one is today's (voice_1 / deep_1 / news_1 / trail_2 are done)
do $$ declare q text; r jsonb;
begin
  select x into q from quests_for_date((now() at time zone 'utc')::date) x
   where x in ('voice_1','deep_1','news_1') limit 1;
  if q is not null then
    r := claim_daily_quest(q);
    assert (r->'gained'->>'xp')::int = 30, 'quest ' || r;
    begin
      perform claim_daily_quest(q);
      raise exception 'double claim allowed';
    exception when others then
      assert sqlerrm like '%already claimed%', sqlerrm;
    end;
  end if;
end $$;

-- RLS isolation: user b sees none of a's rows, but both are on the leaderboard
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from explorations) = 0, 'rls explorations';
  assert (select count(*) from profiles) = 1, 'rls profiles';
  assert (select count(*) from get_leaderboard(10)) = 2, 'leaderboard';
  assert (select rank from get_leaderboard(10) where is_me) = 2, 'b ranks 2nd';
end $$;

-- anonymous visitors can see the leaderboard but not play
reset role;
set role anon;
select pg_temp.expect_error($q$select get_my_state()$q$, 'permission denied');
do $$ begin assert (select count(*) from get_leaderboard(5)) = 2, 'anon leaderboard'; end $$;
reset role;

-- quest pick parity fixtures (compared against questsForDate() in tests/game.test.ts)
\pset format unaligned
\pset tuples_only on
\pset fieldsep ' '
\o tests/sql/quest_fixture.txt
select d::date, string_agg(q, ',') from generate_series('2026-09-01'::date, '2026-10-15', '1 day') d,
  lateral quests_for_date(d::date) q group by d order by d;
\o
\echo ALL SQL TESTS PASSED
