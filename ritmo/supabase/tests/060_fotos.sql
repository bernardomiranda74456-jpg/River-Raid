\echo '--- 060 fotos privadas (storage.objects)'
begin;
select test.login(test.bruno());
insert into storage.objects (bucket_id, name, owner) values ('workout-photos', test.grp()::text || '/' || test.bruno()::text || '/foto1.jpg', test.bruno());
select test.ok((select count(*) from storage.objects where name like '%/foto1.jpg') = 1, 'membro envia foto na própria pasta');
select test.ok(test.fails(format($$insert into storage.objects (bucket_id, name) values ('workout-photos', %L)$$, test.grp()::text || '/' || test.ana()::text || '/foto2.jpg')), 'membro não envia na pasta de outra pessoa');
select test.ok(test.fails(format($$insert into storage.objects (bucket_id, name) values ('workout-photos', %L)$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/' || test.bruno()::text || '/foto3.jpg')), 'membro não envia em grupo que não participa');
select test.ok(test.fails(format($$insert into storage.objects (bucket_id, name) values ('workout-photos', %L)$$, test.grp()::text || '/' || test.bruno()::text || '/sub/foto4.jpg')), 'subpastas extras são rejeitadas');
select test.ok(test.fails(format($$insert into storage.objects (bucket_id, name) values ('outro-bucket', %L)$$, test.grp()::text || '/' || test.bruno()::text || '/foto5.jpg')), 'outro bucket é rejeitado');

select test.login(test.carla());
select test.ok((select count(*) from storage.objects where name like '%/foto1.jpg') = 1, 'outra participante vê a foto');

select test.login(test.dani());
select test.ok((select count(*) from storage.objects where name = test.grp()::text || '/' || test.bruno()::text || '/foto1.jpg') = 0, 'fora do grupo: não lê a foto mesmo com o caminho exato');
select test.ok((select count(*) from storage.objects) = 0, 'fora do grupo: não lista nada');
select test.ok(test.fails(format($$delete from storage.objects where name = %L$$, test.grp()::text || '/' || test.bruno()::text || '/foto1.jpg')) or (select count(*) from storage.objects where name like '%/foto1.jpg') = 0, 'fora do grupo: delete não afeta (0 linhas)');
select test.login(test.bruno());
select test.ok((select count(*) from storage.objects where name like '%/foto1.jpg') = 1, 'foto continua existindo');
select test.login(test.carla());
delete from storage.objects where name like '%/foto1.jpg';
select test.login(test.bruno());
select test.ok((select count(*) from storage.objects where name like '%/foto1.jpg') = 1, 'outra participante não apaga foto alheia');
delete from storage.objects where name like '%/foto1.jpg';
select test.ok((select count(*) from storage.objects where name like '%/foto1.jpg') = 0, 'dona apaga a própria foto');
rollback;
