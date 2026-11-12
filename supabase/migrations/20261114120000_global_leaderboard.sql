-- One global ranking with one prize (DECISIONS 035), replacing the separate
-- party ranking. quiz_leaderboard stays for the per-question ranking and the
-- quiz podium.

drop view public.party_leaderboard;

-- total = quiz + challenges + the player's best show act. Someone can perform
-- in several acts, but only the best one counts, so the show stays an extra
-- and not a points farm. The ledger keeps one row per act; the rule lives here.
-- Guests only: the host doesn't play the quiz and doesn't compete for the prize.
create view public.leaderboard
with (security_invoker = true) as
with per_player as (
  select
    p.id, p.name, p.emoji,
    coalesce(sum(l.points) filter (where l.source_type in ('quiz', 'challenge')), 0)
      + coalesce(max(l.points) filter (where l.source_type = 'show'), 0) as total
  from public.players p
  left join public.points_ledger l on l.player_id = p.id
  where not exists (select 1 from public.hosts h where h.user_id = p.id)
  group by p.id
)
select
  id    as player_id,
  name,
  emoji,
  total::int as total,
  rank() over (order by total desc)::int as rank
from per_player;

-- Rebalance so the three blocks weigh similarly: the quiz (~25 questions,
-- up to 1000 each) would otherwise decide the winner alone. The show weighs
-- less (max 1500 per act) so not performing doesn't leave anyone behind.
update public.scoring_config
set challenge_presets = '{3000, 2000, 1000, 500}',
    show_points_per_star = 300
where id = 1;
