-- Dados fictícios para desenvolvimento (rodam em `supabase db reset` e no harness local).
-- NÃO use em produção. Senha de todos: ritmo123 (apenas para o Supabase local).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'ana@ritmo.dev',   crypt('ritmo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ana Souza"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'bruno@ritmo.dev', crypt('ritmo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Bruno Lima"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'carla@ritmo.dev', crypt('ritmo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Carla Mendes"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'dani@ritmo.dev',  crypt('ritmo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Dani Rocha"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email like '%@ritmo.dev';

-- Grupo de exemplo: começou há 10 dias, dura 4 semanas. Dani fica de fora (teste de isolamento).
insert into public.groups (id, name, owner_id, invite_code, timezone, starts_on, ends_on)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Desafio de Novembro', '11111111-1111-4111-8111-111111111111',
        'SUPERA26', 'America/Sao_Paulo', current_date - 10, current_date + 18);

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'organizer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'member');

-- Treinos (pontos calculados pela mesma função usada no servidor)
with t as (
  select f.code, f.modality, f.modality_label, f.variant_label, f.factor, ft.version
  from public.factors f join public.factor_tables ft on ft.id = f.table_id and ft.is_active
),
rows as (
  select * from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'c0000001-0000-4000-8000-000000000001'::uuid, current_date - 9, 30, 'corrida_630_730',   'Primeiro treino do desafio!'),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'c0000001-0000-4000-8000-000000000002'::uuid, current_date - 2, 45, 'musculacao_8_15',   'Perna hoje.'),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'c0000001-0000-4000-8000-000000000003'::uuid, current_date,     40, 'ciclismo_20kmh',    'Pedal na orla.'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'c0000002-0000-4000-8000-000000000001'::uuid, current_date - 8, 60, 'caminhada_5kmh',    null),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'c0000002-0000-4000-8000-000000000002'::uuid, current_date - 1, 30, 'corrida_630_730',   'Ritmo confortável.'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'c0000002-0000-4000-8000-000000000003'::uuid, current_date,     45, 'pickleball_duplas', 'Duplas com a galera.'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'c0000003-0000-4000-8000-000000000001'::uuid, current_date - 3, 50, 'natacao_crawl_211', 'Piscina cheia.'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'c0000003-0000-4000-8000-000000000002'::uuid, current_date - 1, 30, 'caminhada_5kmh',    null)
  ) as r(user_id, client_id, performed_on, duration_min, factor_code, caption)
)
insert into public.workouts (group_id, user_id, client_id, performed_on, duration_min, factor_table_version,
  factor_code, modality, modality_label, variant_label, factor_value, points, caption)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', r.user_id, r.client_id, r.performed_on, r.duration_min, t.version,
  t.code, t.modality, t.modality_label, t.variant_label, t.factor, public.calc_points(r.duration_min, t.factor), r.caption
from rows r join t on t.code = r.factor_code;

insert into public.workout_likes (workout_id, user_id)
select w.id, '22222222-2222-4222-8222-222222222222' from public.workouts w where w.client_id = 'c0000001-0000-4000-8000-000000000001';
insert into public.workout_likes (workout_id, user_id)
select w.id, '33333333-3333-4333-8333-333333333333' from public.workouts w where w.client_id = 'c0000001-0000-4000-8000-000000000001';

insert into public.workout_comments (workout_id, user_id, body)
select w.id, '22222222-2222-4222-8222-222222222222', 'Boa, Ana! Bora manter.' from public.workouts w where w.client_id = 'c0000001-0000-4000-8000-000000000001';

insert into public.messages (group_id, user_id, body) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Bem-vindos ao desafio! Vale qualquer treino com registro.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'Alguém topa pedal no sábado?'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'Eu topo! 7h na orla.');
