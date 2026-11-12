-- The host decides when every phone switches to the quiz podium (DECISIONS 035).
-- Phones show it while the last question is revealed and quiz_podium is on;
-- opening any question hides it again.
alter table public.party_state
  add column quiz_podium boolean not null default false;

-- Same column-level grant as phase/current_challenge_id/current_act_id:
-- the "host updates party state" policy keeps it host-only.
grant update (quiz_podium) on public.party_state to authenticated;
