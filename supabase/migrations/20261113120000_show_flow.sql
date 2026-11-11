-- Show flow (DECISIONS 034): the host runs one act at a time,
-- performing → voting → done, with start_act / open_voting / close_voting.

-- 1. The host's panel counts votes live. Realtime applies RLS, so a guest
-- only receives changes to their own vote.
alter publication supabase_realtime add table public.show_votes;

-- 2. At most one act on stage (performing or voting), whatever writes the status.
create unique index show_acts_one_on_stage
  on public.show_acts ((true)) where status in ('performing', 'voting');

-- 3. points_ledger.source_id is not a foreign key, so deleting a scored act
-- would leave orphan points in the party ranking (same as DECISIONS 033).
create function public.act_has_points(p_act_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.points_ledger
    where source_type = 'show' and source_id = p_act_id
  );
$$;

drop policy "host manages acts" on public.show_acts;

create policy "host creates acts"
  on public.show_acts for insert to authenticated
  with check ((select public.is_host()));

create policy "host edits acts"
  on public.show_acts for update to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

create policy "host removes acts without points"
  on public.show_acts for delete to authenticated
  using ((select public.is_host()) and not public.act_has_points(id));

-- 4. Put an act on stage. An act still performing goes back to pending; an
-- act being voted must be closed first, so no votes are lost. A done act can
-- be started again to redo it (close_voting recomputes its points).
create function public.start_act(p_act_id uuid)
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

  if v_phase <> 'show' then
    raise exception 'Not in the show phase';
  end if;

  if not exists (select 1 from public.show_acts where id = p_act_id) then
    raise exception 'Act not found';
  end if;

  if exists (select 1 from public.show_acts where status = 'voting') then
    raise exception 'Close the voting first';
  end if;

  update public.show_acts set status = 'pending'
  where status = 'performing' and id <> p_act_id;

  update public.show_acts set status = 'performing' where id = p_act_id;

  update public.party_state set current_act_id = p_act_id where id = 1;
end;
$$;

-- 5. The current act has finished performing: everyone can vote.
create function public.open_voting()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_act_id uuid;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select current_act_id into v_act_id from public.party_state where id = 1 for update;

  update public.show_acts set status = 'voting'
  where id = v_act_id and status = 'performing';

  if not found then
    raise exception 'No act is performing';
  end if;
end;
$$;

-- 6. Withdraw a sign-up before it goes on stage: its creator or the host.
-- Members cascade.
create function public.withdraw_act(p_act_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_act public.show_acts;
begin
  select * into v_act from public.show_acts where id = p_act_id for update;

  if v_act.id is null then
    raise exception 'Act not found';
  end if;

  if v_act.created_by is distinct from auth.uid() and not public.is_host() then
    raise exception 'Only its creator can withdraw this act';
  end if;

  if v_act.status <> 'pending' then
    raise exception 'This act has already been on stage';
  end if;

  delete from public.show_acts where id = p_act_id;
end;
$$;

revoke execute on function
  public.act_has_points(uuid),
  public.start_act(uuid),
  public.open_voting(),
  public.withdraw_act(uuid)
from public, anon;

grant execute on function
  public.act_has_points(uuid),
  public.start_act(uuid),
  public.open_voting(),
  public.withdraw_act(uuid)
to authenticated;
