-- Corrige nombres/contactos vacíos en el superadministrador.
-- Solo concede lectura a superadministradores activos. No modifica registros.
begin;
drop policy if exists "Superadmin consulta tiendas" on public.tiendas;
create policy "Superadmin consulta tiendas" on public.tiendas
for select to authenticated
using (public.es_tamaku_superadmin());
notify pgrst, 'reload schema';
commit;
