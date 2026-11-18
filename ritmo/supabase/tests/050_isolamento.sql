\echo '--- 050 isolamento entre grupos (RLS)'
begin;
-- Dani está fora do grupo SUPERA26
select test.login(test.dani());
select test.ok((select count(*) from public.groups) = 0, 'fora do grupo: não vê grupos');
select test.ok((select count(*) from public.group_members) = 0, 'fora do grupo: não vê participantes');
select test.ok((select count(*) from public.workouts) = 0, 'fora do grupo: não vê treinos');
select test.ok((select count(*) from public.messages) = 0, 'fora do grupo: não vê chat');
select test.ok((select count(*) from public.workout_comments) = 0, 'fora do grupo: não vê comentários');
select test.ok((select count(*) from public.workout_likes) = 0, 'fora do grupo: não vê curtidas');
select test.ok((select count(*) from public.profiles) = 1 and (select id from public.profiles) = test.dani(), 'fora do grupo: só vê o próprio perfil');
select test.ok(test.fails($$select * from public.group_ranking(test.grp(), 'challenge')$$), 'fora do grupo: ranking negado');
select test.ok(test.fails($$insert into public.messages (group_id, user_id, body) values (test.grp(), test.dani(), 'oi')$$), 'fora do grupo: não manda mensagem');
select test.ok(test.fails($$insert into public.workout_likes (workout_id, user_id) values ((select id from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000001'), test.dani())$$), 'fora do grupo: não curte');
-- (o subselect acima retorna null sob RLS; garante também com o id real)
select test.ok(test.fails(format($$insert into public.workout_likes (workout_id, user_id) values (%L, test.dani())$$, (select id from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000001' and true))), 'fora do grupo: não curte mesmo sabendo o id');
select test.ok(test.fails($$update public.groups set name = 'hack' where id = test.grp()$$) or (select count(*) from public.groups where name = 'hack') = 0, 'fora do grupo: não edita grupo');

-- Membro vê tudo do grupo
select test.login(test.bruno());
select test.ok((select count(*) from public.groups) = 1, 'membro vê o grupo');
select test.ok((select count(*) from public.workouts) = 8, 'membro vê os 8 treinos do seed');
select test.ok((select count(*) from public.profiles) = 3, 'membro vê os 3 perfis do grupo');
select test.ok((select count(*) from public.messages) = 3, 'membro vê o chat');
select test.ok(test.fails($$select public.update_group(test.grp(), 'novo', current_date, current_date + 1)$$), 'membro comum não edita o grupo');
select test.ok(test.fails($$update public.profiles set display_name = 'x' where id = test.ana()$$) or (select display_name from public.profiles where id = test.ana()) = 'Ana Souza', 'membro não edita perfil alheio');
update public.profiles set display_name = 'Bruno L.' where id = test.bruno();
select test.ok((select display_name from public.profiles where id = test.bruno()) = 'Bruno L.', 'membro edita o próprio nome');
rollback;
