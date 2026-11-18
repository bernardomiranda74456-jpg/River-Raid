\echo '--- 020 grupo e convite'
begin;
select test.login(test.dani());
select test.ok((select count(*) from public.groups) = 0, 'Dani não vê nenhum grupo antes de criar');

create temp table g as select * from public.create_group('Turma da Dani', current_date, current_date + 27, 'America/Sao_Paulo');
select test.ok((select count(*) from public.groups) = 1, 'Dani vê o grupo que criou');
select test.ok((select role from public.group_members where group_id = (select id from g) and user_id = test.dani()) = 'organizer', 'criadora vira organizadora');
select test.ok((select invite_code from g) ~ '^[A-HJ-NP-Z2-9]{8}$', 'código de convite com 8 caracteres sem ambiguidade');
select test.ok(test.fails($$select public.create_group('x', current_date, current_date - 1)$$), 'período invertido é rejeitado');
select test.ok(test.fails($$select public.create_group('x', current_date, current_date + 1, 'Marte/Olympus')$$), 'fuso inválido é rejeitado');

-- Carla entra por código (minúsculas, com traço)
select test.login(test.carla());
select test.ok((select id from public.join_group(lower(left((select invite_code from g),4)) || '-' || right((select invite_code from g),4))) = (select id from g), 'entrar por código normaliza caixa e separadores');
select test.ok(public.is_group_member((select id from g)), 'Carla agora participa');
select test.ok((select id from public.join_group((select invite_code from g))) = (select id from g), 'entrar de novo é idempotente');
select test.ok(test.fails($$select public.join_group('NAOEXIST')$$), 'código inexistente falha');

-- anônimo não cria grupo
select set_config('request.jwt.claims', '', true); select set_config('role', 'anon', true);
select test.ok(test.fails($$select public.create_group('x', current_date, current_date)$$), 'anônimo não executa create_group');
rollback;
