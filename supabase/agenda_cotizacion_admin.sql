-- TAMAKU: permite fichas parciales y borrado de prospectos solo por superadmins.
-- Ejecutar en Supabase > SQL Editor despues de las migraciones de agenda y reuniones.

begin;

alter table public.tamaku_agenda_cotizaciones
  alter column nombre_tienda drop not null;

drop policy if exists "Superadmin elimina prospectos de agenda" on public.tamaku_agenda_cotizaciones;
create policy "Superadmin elimina prospectos de agenda"
  on public.tamaku_agenda_cotizaciones
  for delete to authenticated
  using (public.es_tamaku_superadmin());

grant delete on public.tamaku_agenda_cotizaciones to authenticated;

commit;
