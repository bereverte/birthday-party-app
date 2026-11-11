-- Challenges flow (DECISIONS 033): the host creates challenges from /host,
-- starts one at a time and awards points with award_challenge_points.

-- 1. Phones show the current challenge, so edits must reach them.
alter publication supabase_realtime add table public.challenges;

-- 2. Challenges are now typed on a phone, so validate them in the database.
alter table public.challenges
  add constraint challenges_name_length
    check (char_length(trim(name)) between 1 and 40),
  add constraint challenges_description_length
    check (description is null or char_length(description) <= 200),
  add constraint challenges_emoji_length
    check (char_length(emoji) between 1 and 16);

-- At most one active challenge, whatever writes the status.
create unique index challenges_one_active
  on public.challenges ((true)) where status = 'active';

-- 3. points_ledger.source_id is not a foreign key, so deleting a challenge
-- with points would leave orphan points in the party ranking. Same pattern
-- as player_has_activity (DECISIONS 024).
create function public.challenge_has_points(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.points_ledger
    where source_type = 'challenge' and source_id = p_challenge_id
  );
$$;

drop policy "host manages challenges" on public.challenges;

create policy "host creates challenges"
  on public.challenges for insert to authenticated
  with check ((select public.is_host()));

create policy "host edits challenges"
  on public.challenges for update to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

create policy "host removes challenges without points"
  on public.challenges for delete to authenticated
  using ((select public.is_host()) and not public.challenge_has_points(id));

-- 4. Start a challenge: the previous active one is done, this one is active
-- and becomes party_state.current_challenge_id, all in one transaction.
-- A done challenge can be started again to fix its results.
create function public.start_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select phase into v_phase from public.party_state where id = 1 for update;

  if v_phase <> 'challenges' then
    raise exception 'Not in the challenges phase';
  end if;

  if not exists (select 1 from public.challenges where id = p_challenge_id) then
    raise exception 'Challenge not found';
  end if;

  update public.challenges set status = 'done'
  where status = 'active' and id <> p_challenge_id;

  update public.challenges set status = 'active' where id = p_challenge_id;

  update public.party_state set current_challenge_id = p_challenge_id where id = 1;
end;
$$;

-- Finish the current challenge: back to "waiting for the next one".
create function public.finish_challenge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  perform 1 from public.party_state where id = 1 for update;

  update public.challenges set status = 'done' where status = 'active';

  update public.party_state set current_challenge_id = null where id = 1;
end;
$$;

revoke execute on function
  public.challenge_has_points(uuid),
  public.start_challenge(uuid),
  public.finish_challenge()
from public, anon;

grant execute on function
  public.challenge_has_points(uuid),
  public.start_challenge(uuid),
  public.finish_challenge()
to authenticated;
