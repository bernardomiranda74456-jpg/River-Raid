\echo '--- 070 curtidas, comentários e chat'
begin;
select test.login(test.ana());
create temp table w as select id from public.workouts where client_id = 'c0000002-0000-4000-8000-000000000002';
insert into public.workout_likes (workout_id, user_id) values ((select id from w), test.ana());
select test.ok((select count(*) from public.workout_likes where workout_id = (select id from w)) = 1, 'Ana curte o treino do Bruno');
select test.ok(test.fails($$insert into public.workout_likes (workout_id, user_id) values ((select id from w), test.ana())$$), 'curtir duas vezes falha');
select test.ok(test.fails($$insert into public.workout_likes (workout_id, user_id) values ((select id from w), test.bruno())$$), 'não curte em nome de outra pessoa');
insert into public.workout_comments (workout_id, user_id, body) values ((select id from w), test.ana(), 'Mandou bem!');
select test.ok((select count(*) from public.workout_comments where workout_id = (select id from w)) = 1, 'Ana comenta');
select test.ok(test.fails($$insert into public.workout_comments (workout_id, user_id, body) values ((select id from w), test.ana(), '')$$), 'comentário vazio falha');
insert into public.messages (group_id, user_id, body) values (test.grp(), test.ana(), 'Parabéns, Bruno!');
select test.ok((select count(*) from public.messages where group_id = test.grp()) = 4, 'mensagem no chat (separada dos comentários)');
select test.ok((select count(*) from public.workout_comments) = 2, 'comentários não viram mensagens');

-- treino removido não recebe curtidas/comentários novos
select public.remove_workout((select id from w), 'Teste de remoção');
select test.login(test.carla());
select test.ok(test.fails($$insert into public.workout_likes (workout_id, user_id) values ((select id from w), test.carla())$$), 'treino removido não recebe curtida');
select test.ok(test.fails($$insert into public.workout_comments (workout_id, user_id, body) values ((select id from w), test.carla(), 'x')$$), 'treino removido não recebe comentário');

-- Bruno vê quem curtiu e apaga só o próprio comentário
select test.login(test.bruno());
select test.ok((select count(*) from public.workout_likes l join public.profiles p on p.id = l.user_id where l.workout_id = (select id from w)) = 1, 'Bruno vê a curtida com perfil');
delete from public.workout_comments where workout_id = (select id from w);
select test.ok((select count(*) from public.workout_comments where workout_id = (select id from w)) = 1, 'Bruno não apaga comentário da Ana');
rollback;
