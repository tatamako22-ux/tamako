-- Permite completar de forma segura el registro inicial de una tienda.
-- Ejecutar una vez en Supabase > SQL Editor.

begin;

alter table public.tiendas enable row level security;
alter table public.perfiles enable row level security;

drop policy if exists "Usuario crea su propia tienda" on public.tiendas;
create policy "Usuario crea su propia tienda"
on public.tiendas
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Propietario crea su perfil inicial" on public.perfiles;
create policy "Propietario crea su perfil inicial"
on public.perfiles
for insert
to authenticated
with check (
  perfiles.user_id = auth.uid()
  and lower(perfiles.rol::text) in ('admin', 'administrador')
  and perfiles.activo = true
  and exists (
    select 1
    from public.tiendas t
    where t.id = perfiles.tienda_id
      and t.user_id = auth.uid()
  )
);

commit;
