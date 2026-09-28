-- Cofre privado dos documentos enviados no cadastro do FAST Motorista.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('motorista-documentos', 'motorista-documentos', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760;

drop policy if exists "motorista envia seus documentos" on storage.objects;
create policy "motorista envia seus documentos"
on storage.objects for insert to authenticated
with check (bucket_id='motorista-documentos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "motorista atualiza seus documentos" on storage.objects;
create policy "motorista atualiza seus documentos"
on storage.objects for update to authenticated
using (bucket_id='motorista-documentos' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='motorista-documentos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "motorista le seus documentos" on storage.objects;
create policy "motorista le seus documentos"
on storage.objects for select to authenticated
using (bucket_id='motorista-documentos' and (storage.foldername(name))[1]=auth.uid()::text);
