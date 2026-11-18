create schema if not exists test;

-- Impersona um usuário autenticado dentro da transação atual.
create or replace function test.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function test.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

create or replace function test.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FALHOU: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Executa uma instrução esperando erro; devolve true se falhou.
create or replace function test.fails(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;

grant usage on schema test to authenticated, anon;
grant execute on all functions in schema test to authenticated, anon;

-- constantes
create or replace function test.ana()   returns uuid language sql immutable as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
create or replace function test.bruno() returns uuid language sql immutable as $$ select '22222222-2222-4222-8222-222222222222'::uuid $$;
create or replace function test.carla() returns uuid language sql immutable as $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;
create or replace function test.dani()  returns uuid language sql immutable as $$ select '44444444-4444-4444-8444-444444444444'::uuid $$;
create or replace function test.grp()   returns uuid language sql immutable as $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
grant execute on all functions in schema test to authenticated, anon;
