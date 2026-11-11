-- Quiz content loader. Copy this file to supabase/quiz-content.sql (ignored
-- by git: the real answers must not be in a public repo), write the real
-- questions and run it in Supabase Studio → SQL Editor (cloud or local).
--
-- It REPLACES all questions. To protect the party, it refuses to run once
-- anyone has answered (that would delete answers and orphan quiz points).
--
-- Every question: "text", optionally "time" (seconds, 5–120, default 20),
-- "image" (URL, shown while the question is open) and "reveal_image" (URL,
-- shown only at the reveal: use it for photos that give the answer away).
-- Then, by "type" (default "single"):
--   single: "options" (2–6) and "correct": one letter ("A", "B"…).
--   multi:  "options" (2–6) and "correct": a list of letters (["A", "C"]).
--           Any wrong mark scores 0; otherwise the share of correct ones
--           marked (DECISIONS 031).
--   number: "max" (1–100, keep it ≤ 10 for the − / + buttons), "answer"
--           (0–max) and optionally "close": answers within that distance
--           get half points (default 0: only the exact answer scores).
--           No options.
--   text:   "answers": list of spellings worth full points (the first is
--           shown at the reveal) and optionally "close": list worth half.
--           Compared in lower case, without accents, spaces or punctuation.

do $$
declare
  q        jsonb;
  v_kind   text;
  v_qid    uuid;
  v_oid    uuid;
  v_pos    int := 0;
  v_count  int;
  v_right  int[];
  v_letter text;
  i        int;
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
    "text": "Té gat?",
    "options": ["Sí", "No"],
    "correct": "B",
    "time": 10
  },
  {
    "type": "multi",
    "text": "Quins instruments ha tocat?",
    "options": ["Piano", "Guitarra", "Saxo", "Bateria"],
    "correct": ["A", "B"],
    "time": 25
  },
  {
    "type": "number",
    "text": "Quants tatuatges s'ha fet ella mateixa?",
    "max": 10,
    "answer": 3
  },
  {
    "type": "number",
    "text": "Quants km va córrer a la primera marató?",
    "max": 60,
    "answer": 42,
    "close": 2
  },
  {
    "type": "text",
    "text": "Com es diu el seu millor company de vida?",
    "answers": ["Nuc"],
    "close": ["Nuk", "Nuck"],
    "reveal_image": "https://example.com/nuc.jpg",
    "time": 25
  }
]
$json$::jsonb) loop
    v_pos := v_pos + 1;
    v_kind := coalesce(q->>'type', 'single');

    if v_kind = 'text' then
      if jsonb_typeof(q->'answers') is distinct from 'array' or jsonb_array_length(q->'answers') = 0 then
        raise exception 'Question %: a text question needs "answers" (a list)', v_pos;
      end if;

      insert into public.quiz_questions (position, text, kind, time_limit_s, image_url)
      values (v_pos, q->>'text', 'text', coalesce((q->>'time')::int, 20), q->>'image')
      returning id into v_qid;

      -- Full-credit answers first (the first one is shown at the reveal),
      -- then the half-credit spellings from "close".
      insert into public.quiz_text_keys (question_id, position, answer, credit)
      select v_qid, row_number() over (), a.answer, a.credit
      from (
        select value as answer, 1.0 as credit, 0 as grp, ord
        from jsonb_array_elements_text(q->'answers') with ordinality as t(value, ord)
        union all
        select value, 0.5, 1, ord
        from jsonb_array_elements_text(coalesce(q->'close', '[]'::jsonb)) with ordinality as t(value, ord)
        order by grp, ord
      ) a;

      if q->>'reveal_image' is not null then
        insert into public.quiz_reveal_images (question_id, image_url) values (v_qid, q->>'reveal_image');
      end if;
      continue;
    end if;

    if v_kind = 'number' then
      if (q->>'max') is null or (q->>'answer') is null
         or (q->>'answer')::int not between 0 and (q->>'max')::int then
        raise exception 'Question %: a number question needs "max" and an "answer" between 0 and max', v_pos;
      end if;

      insert into public.quiz_questions (position, text, kind, number_max, number_tolerance, time_limit_s, image_url)
      values (v_pos, q->>'text', 'number', (q->>'max')::int, coalesce((q->>'close')::int, 0),
              coalesce((q->>'time')::int, 20), q->>'image')
      returning id into v_qid;

      insert into public.quiz_number_keys (question_id, value) values (v_qid, (q->>'answer')::int);
      if q->>'reveal_image' is not null then
        insert into public.quiz_reveal_images (question_id, image_url) values (v_qid, q->>'reveal_image');
      end if;
      continue;
    end if;

    if v_kind not in ('single', 'multi') then
      raise exception 'Question %: unknown type "%"', v_pos, v_kind;
    end if;

    v_count := jsonb_array_length(q->'options');
    if v_count not between 2 and 6 then
      raise exception 'Question %: needs 2–6 options', v_pos;
    end if;

    -- "correct" as one letter or a list of letters → 0-based indexes.
    v_right := array(
      select ascii(upper(l)) - ascii('A')
      from jsonb_array_elements_text(
        case jsonb_typeof(q->'correct') when 'array' then q->'correct' else jsonb_build_array(q->'correct') end
      ) as l
    );
    if cardinality(v_right) = 0
       or exists (select 1 from unnest(v_right) r where r not between 0 and v_count - 1)
       or (v_kind = 'single' and cardinality(v_right) <> 1) then
      raise exception 'Question %: "correct" must be valid letters (exactly one for single)', v_pos;
    end if;

    insert into public.quiz_questions (position, text, kind, time_limit_s, image_url)
    values (v_pos, q->>'text', v_kind, coalesce((q->>'time')::int, 20), q->>'image')
    returning id into v_qid;

    for i in 0 .. v_count - 1 loop
      insert into public.quiz_options (question_id, position, text)
      values (v_qid, i + 1, q->'options'->>i)
      returning id into v_oid;

      if i = any (v_right) then
        insert into public.quiz_keys (question_id, correct_option_id) values (v_qid, v_oid);
      end if;
    end loop;

    if q->>'reveal_image' is not null then
      insert into public.quiz_reveal_images (question_id, image_url) values (v_qid, q->>'reveal_image');
    end if;
  end loop;

  raise notice 'Loaded % questions', v_pos;
end;
$$;
