\echo '--- 030 check-in: validações e idempotência'
begin;
select test.login(test.dani());
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'corrida_630_730')$$), 'quem está fora do grupo não registra');

select test.login(test.bruno());
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 0, 'corrida_630_730')$$), 'duração 0 é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 601, 'corrida_630_730')$$), 'duração 601 é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'corrida_voadora')$$), 'modalidade inexistente é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date - 30, 30, 'corrida_630_730')$$), 'data antes do desafio é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date + 2, 30, 'corrida_630_730')$$), 'data futura é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'corrida_630_730', null, test.grp()::text || '/' || test.ana()::text || '/x.jpg')$$), 'foto na pasta de outra pessoa é rejeitada');
select test.ok(test.fails($$select public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'corrida_630_730', null, 'qualquer/coisa.jpg')$$), 'caminho de foto fora do padrão é rejeitado');

-- Idempotência: reenvio com o mesmo client_id conta uma vez
create temp table ids as select gen_random_uuid() as cid;
create temp table w1 as select * from public.create_workout(test.grp(), (select cid from ids), current_date, 30, 'corrida_630_730', 'primeira tentativa', test.grp()::text || '/' || test.bruno()::text || '/' || (select cid from ids)::text || '.jpg');
create temp table w2 as select * from public.create_workout(test.grp(), (select cid from ids), current_date, 30, 'corrida_630_730', 'reenvio', null);
select test.ok((select id from w1) = (select id from w2), 'reenvio devolve o mesmo treino');
select test.ok((select count(*) from public.workouts where client_id = (select cid from ids)) = 1, 'só um registro no banco');
select test.ok((select caption from w2) = 'primeira tentativa', 'o primeiro envio prevalece');
select test.ok((select photo_path from w2) like test.grp()::text || '/%', 'foto preservada no reenvio');

-- Escrita direta na tabela é bloqueada (só via RPC)
select test.ok(test.fails($$insert into public.workouts (group_id, user_id, client_id, performed_on, duration_min, factor_table_version, factor_code, modality, modality_label, variant_label, factor_value, points) values (test.grp(), test.bruno(), gen_random_uuid(), current_date, 30, 'v1', 'x', 'x', 'x', 'x', 1, 9999)$$), 'insert direto em workouts é negado');
select test.ok(test.fails($$update public.workouts set points = 9999 where user_id = test.bruno()$$), 'update direto em workouts é negado');
rollback;
