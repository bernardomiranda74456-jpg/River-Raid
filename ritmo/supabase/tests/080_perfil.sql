\echo '--- 080 perfil criado automaticamente'
begin;
insert into auth.users (id, email, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('55555555-5555-4555-8555-555555555555', 'eva@example.com', '{"display_name":"  Eva Prado "}', '', '', '', '');
select test.ok((select display_name from public.profiles where id = '55555555-5555-4555-8555-555555555555') = 'Eva Prado', 'perfil criado com o nome informado (sem espaços)');
insert into auth.users (id, email, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('66666666-6666-4666-8666-666666666666', 'fulano.tal@example.com', '{}', '', '', '', '');
select test.ok((select display_name from public.profiles where id = '66666666-6666-4666-8666-666666666666') = 'fulano.tal', 'sem nome, usa o prefixo do e-mail');
update auth.users set raw_user_meta_data = '{"display_name":"Fulano Tal"}' where id = '66666666-6666-4666-8666-666666666666';
select test.ok((select display_name from public.profiles where id = '66666666-6666-4666-8666-666666666666') = 'Fulano Tal', 'nome atualizado quando os metadados mudam');
rollback;
