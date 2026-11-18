\echo '--- 010 pontuação e tabela de fatores'
begin;
select test.ok((select count(*) from public.factors f join public.factor_tables t on t.id=f.table_id where t.is_active) = 30, 'tabela ativa tem 30 fatores');
select test.ok((select count(*) from public.factor_tables where is_active) = 1, 'exatamente uma tabela ativa');
select test.ok((select count(*) from public.factors where provisional) = 2, 'dois fatores provisórios (beach tennis)');

select test.ok(public.calc_points(30, 1.00) = 30,  '30 min caminhada 5 km/h = 30');
select test.ok(public.calc_points(30, 2.80) = 84,  '30 min corrida 6:30–7:30 = 84');
select test.ok(public.calc_points(40, 2.50) = 100, '40 min pedal 20 km/h = 100');
select test.ok(public.calc_points(45, 1.11) = 50,  '45 min pickleball duplas = 50');
select test.ok(public.calc_points(10, 0.64) = 6,   '10 min pilates = 6 (6,4 arredonda para baixo)');
select test.ok(public.calc_points(25, 0.89) = 22,  '25 min musculação = 22 (22,25)');
select test.ok(public.calc_points(5, 0.71) = 4,    '5 min surfe = 4 (3,55 arredonda para cima)');

-- Via RPC, como usuária real
select test.login(test.bruno());
select test.ok((select points from public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'corrida_630_730', 'teste', null)) = 84, 'RPC: corrida 30 min = 84 pontos');
select test.ok((select points from public.create_workout(test.grp(), gen_random_uuid(), current_date, 45, 'pickleball_duplas', null, null)) = 50, 'RPC: pickleball 45 min = 50 pontos');
select test.ok((select factor_table_version from public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'caminhada_5kmh', null, null)) = 'v1', 'RPC guarda a versão da tabela');
select test.ok((select factor_value from public.create_workout(test.grp(), gen_random_uuid(), current_date, 30, 'ciclismo_20kmh', null, null)) = 2.50, 'RPC guarda o fator usado');
rollback;
