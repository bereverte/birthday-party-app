-- Postgres Changes for the tables clients listen to (DECISIONS 010).
-- Realtime applies each subscriber's RLS: a guest only receives changes to
-- their own quiz answer, while the host receives all of them.
alter publication supabase_realtime add table
  public.party_state,
  public.quiz_answers,
  public.show_acts,
  public.show_act_members,
  public.points_ledger;
