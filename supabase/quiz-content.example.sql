-- Quiz content loader. Copy this file to supabase/quiz-content.sql (ignored
-- by git: the real answers must not be in a public repo), write the real
-- questions and run it in Supabase Studio → SQL Editor (cloud or local).
--
-- It REPLACES all questions. To protect the party, it refuses to run once
-- anyone has answered (that would delete answers and orphan quiz points).
--
-- Each question: "text", "options" (2 to 6), "correct" (letter: A, B, C…)
-- and optionally "time" (seconds, 5–120, default 20) and "image" (URL).

do $$
declare
  q       jsonb;
  v_qid   uuid;
  v_oid   uuid;
  v_pos   int := 0;
  v_right int;
  i       int;
begin
  if exists (select 1 from public.quiz_answers) then
    raise exception 'Someone has already answered: questions cannot be replaced now';
  end if;

  delete from public.quiz_questions;  -- cascades to options and keys
  update public.party_state
  set current_question_id = null, question_status = 'idle',
      question_opened_at = null, question_closes_at = null
  where id = 1;

  for q in select * from jsonb_array_elements($json$
[
  {
    "text": "On va nàixer l'amfitriona?",
    "options": ["València", "Barcelona", "Alacant", "Castelló"],
    "correct": "A"
  },
  {
    "text": "Quin és el seu menjar preferit?",
    "options": ["Paella", "Sushi", "Pizza", "Croquetes"],
    "correct": "D",
    "time": 15
  },
  {
    "text": "Té gat?",
    "options": ["Sí", "No"],
    "correct": "B",
    "time": 10
  }
]
$json$::jsonb) loop
    v_pos := v_pos + 1;
    v_right := ascii(upper(q->>'correct')) - ascii('A');

    if jsonb_array_length(q->'options') not between 2 and 6
       or v_right not between 0 and jsonb_array_length(q->'options') - 1 then
      raise exception 'Question %: needs 2–6 options and a valid "correct" letter', v_pos;
    end if;

    insert into public.quiz_questions (position, text, time_limit_s, image_url)
    values (v_pos, q->>'text', coalesce((q->>'time')::int, 20), q->>'image')
    returning id into v_qid;

    for i in 0 .. jsonb_array_length(q->'options') - 1 loop
      insert into public.quiz_options (question_id, position, text)
      values (v_qid, i + 1, q->'options'->>i)
      returning id into v_oid;

      if i = v_right then
        insert into public.quiz_keys (question_id, correct_option_id) values (v_qid, v_oid);
      end if;
    end loop;
  end loop;

  raise notice 'Loaded % questions', v_pos;
end;
$$;
