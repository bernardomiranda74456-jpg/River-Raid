-- Ritmo — esquema inicial
-- Convenções:
--   * Toda escrita sensível passa por funções SECURITY DEFINER com checagens explícitas.
--   * Leitura é protegida por RLS baseada em participação no grupo.
--   * Pontos oficiais são calculados aqui, nunca confiados ao app.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Nome público de cada pessoa. Criado automaticamente ao cadastrar.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'pessoa'), '@', 1);
  end if;
  insert into public.profiles (id, display_name, email)
  values (new.id, left(v_name, 60), new.email)
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when new.raw_user_meta_data ->> 'display_name' is not null
            then left(btrim(new.raw_user_meta_data ->> 'display_name'), 60)
          else public.profiles.display_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tabela de fatores (versionada)
-- ---------------------------------------------------------------------------
create table public.factor_tables (
  id integer generated always as identity primary key,
  version text not null unique,
  published_at timestamptz not null default now(),
  is_active boolean not null default false,
  notes text
);

create unique index factor_tables_single_active on public.factor_tables (is_active) where is_active;

create table public.factors (
  id uuid primary key default gen_random_uuid(),
  table_id integer not null references public.factor_tables (id) on delete cascade,
  code text not null,
  modality text not null,
  modality_label text not null,
  variant_label text not null,
  factor numeric(5, 2) not null check (factor > 0),
  provisional boolean not null default false,
  sort_order integer not null,
  unique (table_id, code)
);

comment on table public.factors is 'Fator de pontos por minuto para cada modalidade/faixa. Referência: caminhada 5 km/h = 1,00.';

-- ---------------------------------------------------------------------------
-- Grupos e participação
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles (id),
  invite_code text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint groups_period_valid check (ends_on >= starts_on),
  constraint groups_period_max check (ends_on - starts_on <= 366)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('organizer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Treinos (check-ins)
-- ---------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null,
  performed_on date not null,
  duration_min integer not null check (duration_min between 1 and 600),
  factor_table_version text not null,
  factor_code text not null,
  modality text not null,
  modality_label text not null,
  variant_label text not null,
  factor_value numeric(5, 2) not null,
  points integer not null,
  caption text check (caption is null or char_length(caption) <= 500),
  photo_path text,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  removal_reason text,
  unique (user_id, client_id),
  constraint workouts_removal_consistent check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removed_by is not null and char_length(btrim(removal_reason)) >= 3)
  )
);

create index workouts_group_day_idx on public.workouts (group_id, performed_on desc, created_at desc);
create index workouts_user_idx on public.workouts (user_id);

create table public.workout_likes (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index workout_comments_workout_idx on public.workout_comments (workout_id, created_at);

-- ---------------------------------------------------------------------------
-- Chat do grupo (separado dos comentários)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_group_idx on public.messages (group_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_organizer(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.role = 'organizer'
  );
$$;

create or replace function public.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id = auth.uid() or exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

create or replace function public.calc_points(p_duration_min integer, p_factor numeric)
returns integer
language sql
immutable
as $$
  -- inteiro mais próximo (meio arredonda para cima), por check-in
  select round(p_duration_min * p_factor)::integer;
$$;

create or replace function public.group_today(p_group_id uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone g.timezone)::date from public.groups g where g.id = p_group_id;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem 0/O, 1/I/L
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_group(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_timezone text default 'America/Sao_Paulo'
)
returns public.groups
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'Você precisa estar conectado.' using errcode = '42501';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido.' using errcode = '22023';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'A data final precisa ser igual ou posterior à inicial.' using errcode = '22023';
  end if;

  insert into public.groups (name, owner_id, invite_code, timezone, starts_on, ends_on)
  values (btrim(p_name), v_uid, public.generate_invite_code(), p_timezone, p_starts_on, p_ends_on)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'organizer');

  return v_group;
end;
$$;

create or replace function public.join_group(p_code text)
returns public.groups
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'Você precisa estar conectado.' using errcode = '42501';
  end if;
  select * into v_group
  from public.groups
  where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'Convite não encontrado. Confira o código.' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

create or replace function public.update_group(
  p_group_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date
)
returns public.groups
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_group public.groups;
begin
  if not public.is_group_organizer(p_group_id) then
    raise exception 'Só o organizador pode editar o grupo.' using errcode = '42501';
  end if;
  update public.groups
  set name = btrim(p_name), starts_on = p_starts_on, ends_on = p_ends_on
  where id = p_group_id
  returning * into v_group;
  return v_group;
end;
$$;

-- Registra um check-in. Idempotente por (user_id, client_id): reenviar após queda
-- de conexão devolve o mesmo treino em vez de duplicar.
create or replace function public.create_workout(
  p_group_id uuid,
  p_client_id uuid,
  p_performed_on date,
  p_duration_min integer,
  p_factor_code text,
  p_caption text default null,
  p_photo_path text default null
)
returns public.workouts
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_factor public.factors;
  v_version text;
  v_today date;
  v_existing public.workouts;
  v_workout public.workouts;
  v_caption text;
begin
  if v_uid is null then
    raise exception 'Você precisa estar conectado.' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'Identificador do envio ausente.' using errcode = '22023';
  end if;

  -- Reenvio: já existe um treino com este client_id para esta pessoa.
  select * into v_existing from public.workouts
  where user_id = v_uid and client_id = p_client_id;
  if found then
    if v_existing.group_id <> p_group_id then
      raise exception 'Este envio já foi registrado em outro grupo.' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select * into v_group from public.groups where id = p_group_id;
  if not found or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_uid
  ) then
    raise exception 'Você não participa deste grupo.' using errcode = '42501';
  end if;

  select f.* into v_factor
  from public.factors f
  join public.factor_tables t on t.id = f.table_id
  where t.is_active and f.code = p_factor_code;
  if not found then
    raise exception 'Modalidade ou faixa inválida.' using errcode = '22023';
  end if;
  select t.version into v_version from public.factor_tables t where t.id = v_factor.table_id;

  if p_duration_min is null or p_duration_min < 1 or p_duration_min > 600 then
    raise exception 'A duração precisa ficar entre 1 e 600 minutos.' using errcode = '22023';
  end if;

  v_today := (now() at time zone v_group.timezone)::date;
  if p_performed_on is null or p_performed_on < v_group.starts_on or p_performed_on > v_group.ends_on then
    raise exception 'A data precisa estar dentro do período do desafio (% a %).',
      to_char(v_group.starts_on, 'DD/MM/YYYY'), to_char(v_group.ends_on, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if p_performed_on > v_today then
    raise exception 'Não dá para registrar um treino no futuro.' using errcode = '22023';
  end if;

  if p_photo_path is not null and p_photo_path !~ ('^' || p_group_id::text || '/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Caminho da foto inválido.' using errcode = '22023';
  end if;

  v_caption := nullif(btrim(coalesce(p_caption, '')), '');

  insert into public.workouts (
    group_id, user_id, client_id, performed_on, duration_min,
    factor_table_version, factor_code, modality, modality_label, variant_label,
    factor_value, points, caption, photo_path
  ) values (
    p_group_id, v_uid, p_client_id, p_performed_on, p_duration_min,
    v_version, v_factor.code, v_factor.modality, v_factor.modality_label, v_factor.variant_label,
    v_factor.factor, public.calc_points(p_duration_min, v_factor.factor), left(v_caption, 500), p_photo_path
  )
  on conflict (user_id, client_id) do nothing
  returning * into v_workout;

  if v_workout.id is null then
    -- corrida entre dois reenvios simultâneos: devolve o que venceu
    select * into v_workout from public.workouts where user_id = v_uid and client_id = p_client_id;
  end if;
  return v_workout;
end;
$$;

-- Organizador remove um check-in inválido, com motivo registrado.
create or replace function public.remove_workout(p_workout_id uuid, p_reason text)
returns public.workouts
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_workout public.workouts;
begin
  select * into v_workout from public.workouts where id = p_workout_id;
  if not found then
    raise exception 'Treino não encontrado.' using errcode = 'P0002';
  end if;
  if not public.is_group_organizer(v_workout.group_id) then
    raise exception 'Só o organizador pode remover um check-in.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da remoção.' using errcode = '22023';
  end if;
  if v_workout.removed_at is not null then
    return v_workout;
  end if;
  update public.workouts
  set removed_at = now(), removed_by = v_uid, removal_reason = btrim(p_reason)
  where id = p_workout_id
  returning * into v_workout;
  return v_workout;
end;
$$;

-- Janela de datas usada pelo ranking, no fuso do grupo.
create or replace function public.ranking_window(p_group_id uuid, p_period text)
returns table (starts_on date, ends_on date)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_group public.groups;
  v_today date;
begin
  select * into v_group from public.groups where id = p_group_id;
  if not found then
    raise exception 'Grupo não encontrado.' using errcode = 'P0002';
  end if;
  v_today := (now() at time zone v_group.timezone)::date;
  if p_period = '7d' then
    return query select v_today - 6, v_today;
  elsif p_period = 'challenge' then
    return query select v_group.starts_on, v_group.ends_on;
  else
    raise exception 'Período inválido: %', p_period using errcode = '22023';
  end if;
end;
$$;

-- Placar: todos os participantes, empates com a mesma posição (1, 1, 3).
create or replace function public.group_ranking(p_group_id uuid, p_period text default 'challenge')
returns table (
  user_id uuid,
  display_name text,
  points bigint,
  workouts bigint,
  minutes bigint,
  rank integer,
  tied boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end date;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Você não participa deste grupo.' using errcode = '42501';
  end if;
  select w.starts_on, w.ends_on into v_start, v_end from public.ranking_window(p_group_id, p_period) w;

  return query
  with totals as (
    select
      gm.user_id,
      p.display_name,
      coalesce(sum(w.points), 0)::bigint as points,
      count(w.id)::bigint as workouts,
      coalesce(sum(w.duration_min), 0)::bigint as minutes
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.workouts w
      on w.group_id = gm.group_id
     and w.user_id = gm.user_id
     and w.removed_at is null
     and w.performed_on between v_start and v_end
    where gm.group_id = p_group_id
    group by gm.user_id, p.display_name
  )
  select
    t.user_id,
    t.display_name,
    t.points,
    t.workouts,
    t.minutes,
    rank() over (order by t.points desc)::integer as rank,
    (count(*) over (partition by t.points)) > 1 as tied
  from totals t
  order by t.points desc, t.display_name asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.factor_tables enable row level security;
alter table public.factors enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_likes enable row level security;
alter table public.workout_comments enable row level security;
alter table public.messages enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.factor_tables, public.factors, public.groups,
  public.group_members, public.workouts, public.workout_likes, public.workout_comments,
  public.messages to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, delete on public.workout_likes to authenticated;
grant insert, delete on public.workout_comments to authenticated;
grant insert on public.messages to authenticated;
grant delete on public.group_members to authenticated;

-- Funções: apenas usuários autenticados chamam as RPCs.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_group(text, date, date, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.update_group(uuid, text, date, date) to authenticated;
grant execute on function public.create_workout(uuid, uuid, date, integer, text, text, text) to authenticated;
grant execute on function public.remove_workout(uuid, text) to authenticated;
grant execute on function public.ranking_window(uuid, text) to authenticated;
grant execute on function public.group_ranking(uuid, text) to authenticated;
grant execute on function public.group_today(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_organizer(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.calc_points(integer, numeric) to authenticated, anon;

-- profiles
create policy "perfis visíveis para quem divide grupo" on public.profiles
  for select to authenticated using (public.shares_group_with(id));
create policy "cada pessoa edita o próprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- fatores
create policy "fatores públicos para autenticados" on public.factor_tables
  for select to authenticated using (true);
create policy "fatores visíveis para autenticados" on public.factors
  for select to authenticated using (true);

-- groups
create policy "grupo visível para participantes" on public.groups
  for select to authenticated using (public.is_group_member(id));

-- group_members
create policy "participantes visíveis dentro do grupo" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "sair do grupo ou organizador remove" on public.group_members
  for delete to authenticated using (
    (user_id = auth.uid() and role <> 'organizer') or
    (public.is_group_organizer(group_id) and user_id <> auth.uid())
  );

-- workouts (escrita só via RPC)
create policy "treinos visíveis para participantes" on public.workouts
  for select to authenticated using (public.is_group_member(group_id));

-- likes
create policy "curtidas visíveis para participantes" on public.workout_likes
  for select to authenticated using (
    exists (select 1 from public.workouts w where w.id = workout_id and public.is_group_member(w.group_id))
  );
create policy "curtir treinos do grupo" on public.workout_likes
  for insert to authenticated with check (
    user_id = auth.uid() and
    exists (select 1 from public.workouts w where w.id = workout_id and w.removed_at is null and public.is_group_member(w.group_id))
  );
create policy "descurtir" on public.workout_likes
  for delete to authenticated using (user_id = auth.uid());

-- comments
create policy "comentários visíveis para participantes" on public.workout_comments
  for select to authenticated using (
    exists (select 1 from public.workouts w where w.id = workout_id and public.is_group_member(w.group_id))
  );
create policy "comentar treinos do grupo" on public.workout_comments
  for insert to authenticated with check (
    user_id = auth.uid() and
    exists (select 1 from public.workouts w where w.id = workout_id and w.removed_at is null and public.is_group_member(w.group_id))
  );
create policy "apagar o próprio comentário" on public.workout_comments
  for delete to authenticated using (user_id = auth.uid());

-- messages
create policy "chat visível para participantes" on public.messages
  for select to authenticated using (public.is_group_member(group_id));
create policy "enviar mensagem no grupo" on public.messages
  for insert to authenticated with check (user_id = auth.uid() and public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Realtime (quando a publicação do Supabase existir)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.workout_comments;
    alter publication supabase_realtime add table public.workout_likes;
    alter publication supabase_realtime add table public.workouts;
  end if;
end;
$$;
