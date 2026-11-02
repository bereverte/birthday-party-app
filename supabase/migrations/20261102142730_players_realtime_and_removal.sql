-- 1. The lobby lists who has joined, so players changes must reach clients.
alter publication supabase_realtime add table public.players;

-- 2. Every foreign key to players is ON DELETE CASCADE. Deleting an active
-- player would silently remove their points, answers, votes and even the
-- acts they created (with the other members). The host's "remove" button is
-- meant for duplicates (a guest who cleared the browser and joined again),
-- which have no activity, so the policy only allows that case.

-- Security definer so the check sees every row, whatever the caller's RLS.
create function public.player_has_activity(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.points_ledger    where player_id  = p_player_id)
      or exists (select 1 from public.quiz_answers     where player_id  = p_player_id)
      or exists (select 1 from public.show_votes       where voter_id   = p_player_id)
      or exists (select 1 from public.show_act_members where player_id  = p_player_id)
      or exists (select 1 from public.show_acts        where created_by = p_player_id);
$$;

revoke execute on function public.player_has_activity(uuid) from public, anon;
grant execute on function public.player_has_activity(uuid) to authenticated;

drop policy "host removes players" on public.players;

create policy "host removes players without activity"
  on public.players for delete to authenticated
  using ((select public.is_host()) and not public.player_has_activity(id));
