-- Fotos dos treinos: bucket PRIVADO. O caminho do arquivo é
--   <group_id>/<user_id>/<client_id>.jpg
-- Ler exige participação no grupo (primeira pasta); gravar exige que a
-- segunda pasta seja o próprio usuário. Sem política não há acesso, nem
-- com o endereço do arquivo em mãos: URLs assinadas só são geradas para
-- quem passa pela política de SELECT.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-photos', 'workout-photos', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.photo_path_group(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(p_name))[1]::uuid
    else null
  end;
$$;

create or replace function public.photo_path_user(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(p_name))[2]::uuid
    else null
  end;
$$;

grant execute on function public.photo_path_group(text) to authenticated;
grant execute on function public.photo_path_user(text) to authenticated;

drop policy if exists "fotos: ler se participa do grupo" on storage.objects;
create policy "fotos: ler se participa do grupo" on storage.objects
  for select to authenticated using (
    bucket_id = 'workout-photos'
    and public.is_group_member(public.photo_path_group(name))
  );

drop policy if exists "fotos: enviar na própria pasta do grupo" on storage.objects;
create policy "fotos: enviar na própria pasta do grupo" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workout-photos'
    and public.photo_path_user(name) = auth.uid()
    and public.is_group_member(public.photo_path_group(name))
    and array_length(storage.foldername(name), 1) = 2
  );

drop policy if exists "fotos: substituir a própria foto" on storage.objects;
create policy "fotos: substituir a própria foto" on storage.objects
  for update to authenticated using (
    bucket_id = 'workout-photos' and public.photo_path_user(name) = auth.uid()
  ) with check (
    bucket_id = 'workout-photos' and public.photo_path_user(name) = auth.uid()
  );

drop policy if exists "fotos: apagar a própria foto" on storage.objects;
create policy "fotos: apagar a própria foto" on storage.objects
  for delete to authenticated using (
    bucket_id = 'workout-photos' and public.photo_path_user(name) = auth.uid()
  );
