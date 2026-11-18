\echo '--- 040 ranking: períodos, empates, remoção'
begin;
select test.login(test.ana());
-- Seed: Ana 84+40+100=224, Bruno 60+84+50=194, Carla 125+30=155
create temp table r as select * from public.group_ranking(test.grp(), 'challenge');
select test.ok((select points from r where user_id = test.ana()) = 224, 'Ana soma 224 no desafio');
select test.ok((select points from r where user_id = test.bruno()) = 194, 'Bruno soma 194');
select test.ok((select points from r where user_id = test.carla()) = 155, 'Carla soma 155');
select test.ok((select rank from r where user_id = test.ana()) = 1 and (select rank from r where user_id = test.carla()) = 3, 'posições 1..3');
select test.ok((select bool_and(not tied) from r), 'sem empates no seed');

-- Últimos 7 dias: exclui treinos de 8 e 9 dias atrás
create temp table r7 as select * from public.group_ranking(test.grp(), '7d');
select test.ok((select points from r7 where user_id = test.ana()) = 140, 'Ana 7 dias = 140 (sem o treino de 9 dias atrás)');
select test.ok((select points from r7 where user_id = test.bruno()) = 134, 'Bruno 7 dias = 134 (sem a caminhada de 8 dias atrás)');
select test.ok((select starts_on from public.ranking_window(test.grp(), '7d')) = (select ends_on from public.ranking_window(test.grp(), '7d')) - 6, 'janela de 7 dias');
select test.ok(test.fails($$select * from public.ranking_window(test.grp(), 'mes')$$), 'período desconhecido falha');

-- Empate: Carla registra 39 pontos (155 + 39 = 194 = Bruno)
select test.login(test.carla());
select public.create_workout(test.grp(), gen_random_uuid(), current_date, 39, 'caminhada_5kmh');
create temp table re as select * from public.group_ranking(test.grp(), 'challenge');
select test.ok((select rank from re where user_id = test.bruno()) = 2 and (select rank from re where user_id = test.carla()) = 2, 'empate recebe a mesma posição');
select test.ok((select tied from re where user_id = test.bruno()) and (select tied from re where user_id = test.carla()), 'empate marcado');
select test.ok((select count(*) from re where rank = 3) = 0, 'posição 3 fica vazia após empate em 2º');

-- Remoção por organizador reflete no ranking
select test.login(test.bruno());
select test.ok(test.fails($$select public.remove_workout((select id from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000003'), 'tentativa indevida')$$), 'membro comum não remove');
select test.login(test.ana());
select test.ok(test.fails($$select public.remove_workout((select id from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000003'), '')$$), 'remoção sem motivo falha');
select public.remove_workout((select id from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000003'), 'Registro duplicado do pedal');
select test.ok((select removal_reason from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000003') = 'Registro duplicado do pedal', 'motivo registrado');
select test.ok((select points from public.group_ranking(test.grp(), 'challenge') where user_id = test.ana()) = 124, 'ranking desconta o treino removido (224 → 124)');
select test.ok((select count(*) from public.workouts where client_id = 'c0000001-0000-4000-8000-000000000003') = 1, 'treino removido permanece no histórico');

-- Fuso do grupo: hoje é calculado no fuso configurado
select test.ok((select public.group_today(test.grp())) = (now() at time zone 'America/Sao_Paulo')::date, 'group_today usa America/Sao_Paulo');
rollback;
