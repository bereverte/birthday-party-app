-- Sample content for local development. Runs on `supabase db reset`, never in
-- production. Singleton rows (scoring_config, party_state) come from the
-- schema migration. Fixed ids keep the data easy to reference in tests and Studio.

insert into public.quiz_questions (id, position, text, time_limit_s) values
  ('00000000-0000-4000-a000-000000000001', 1, 'On va nàixer l''amfitriona?', 20),
  ('00000000-0000-4000-a000-000000000002', 2, 'Quin és el seu menjar preferit?', 20),
  ('00000000-0000-4000-a000-000000000003', 3, 'Quants anys fa?', 15);

insert into public.quiz_options (id, question_id, position, text) values
  ('00000000-0000-4000-b000-000000000011', '00000000-0000-4000-a000-000000000001', 1, 'València'),
  ('00000000-0000-4000-b000-000000000012', '00000000-0000-4000-a000-000000000001', 2, 'Barcelona'),
  ('00000000-0000-4000-b000-000000000013', '00000000-0000-4000-a000-000000000001', 3, 'Alacant'),
  ('00000000-0000-4000-b000-000000000014', '00000000-0000-4000-a000-000000000001', 4, 'Castelló'),
  ('00000000-0000-4000-b000-000000000021', '00000000-0000-4000-a000-000000000002', 1, 'Paella'),
  ('00000000-0000-4000-b000-000000000022', '00000000-0000-4000-a000-000000000002', 2, 'Sushi'),
  ('00000000-0000-4000-b000-000000000023', '00000000-0000-4000-a000-000000000002', 3, 'Pizza'),
  ('00000000-0000-4000-b000-000000000024', '00000000-0000-4000-a000-000000000002', 4, 'Croquetes'),
  ('00000000-0000-4000-b000-000000000031', '00000000-0000-4000-a000-000000000003', 1, '25'),
  ('00000000-0000-4000-b000-000000000032', '00000000-0000-4000-a000-000000000003', 2, '30'),
  ('00000000-0000-4000-b000-000000000033', '00000000-0000-4000-a000-000000000003', 3, '35'),
  ('00000000-0000-4000-b000-000000000034', '00000000-0000-4000-a000-000000000003', 4, '40');

insert into public.quiz_keys (question_id, correct_option_id) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000011'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000024'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000032');

-- One question of each newer kind (DECISIONS 031).
insert into public.quiz_questions (id, position, text, kind, number_max, time_limit_s) values
  ('00000000-0000-4000-a000-000000000004', 4, 'Quins instruments ha tocat?', 'multi', null, 25),
  ('00000000-0000-4000-a000-000000000005', 5, 'Quants tatuatges s''ha fet ella mateixa?', 'number', 10, 20);

insert into public.quiz_options (id, question_id, position, text) values
  ('00000000-0000-4000-b000-000000000041', '00000000-0000-4000-a000-000000000004', 1, 'Piano'),
  ('00000000-0000-4000-b000-000000000042', '00000000-0000-4000-a000-000000000004', 2, 'Guitarra'),
  ('00000000-0000-4000-b000-000000000043', '00000000-0000-4000-a000-000000000004', 3, 'Saxo'),
  ('00000000-0000-4000-b000-000000000044', '00000000-0000-4000-a000-000000000004', 4, 'Bateria');

insert into public.quiz_keys (question_id, correct_option_id) values
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000041'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000042');

insert into public.quiz_number_keys (question_id, value) values
  ('00000000-0000-4000-a000-000000000005', 3);

insert into public.challenges (id, position, name, emoji, description) values
  ('00000000-0000-4000-c000-000000000001', 1, 'Saltar a corda', '🪢',
   'Qui fa més salts seguits sense ensopegar.'),
  ('00000000-0000-4000-c000-000000000002', 2, 'Cursa de l''ou i la cullera', '🥄',
   'Per equips: arribar a la meta sense que caiga l''ou.');
