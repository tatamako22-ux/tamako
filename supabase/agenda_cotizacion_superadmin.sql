-- TAMAKU: registros de agenda y cotizacion gestionados solo por superadmins.
-- Ejecutar en Supabase > SQL Editor despues de superadmin_suscripciones.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.tamaku_agenda_cotizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre_tienda text not null,
  contacto text,
  email text,
  telefono text,
  direccion text,
  fecha_agenda date,
  valor_cotizacion numeric(12,2) not null default 0 check (valor_cotizacion >= 0),
  estado text not null default 'Pendiente',
  notas text,
  creado_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tamaku_agenda_cotizaciones_fecha_idx
  on public.tamaku_agenda_cotizaciones(fecha_agenda);
create index if not exists tamaku_agenda_cotizaciones_nombre_idx
  on public.tamaku_agenda_cotizaciones(lower(nombre_tienda));

alter table public.tamaku_agenda_cotizaciones enable row level security;

drop policy if exists "Superadmin consulta agenda y cotizaciones" on public.tamaku_agenda_cotizaciones;
create policy "Superadmin consulta agenda y cotizaciones"
  on public.tamaku_agenda_cotizaciones
  for select to authenticated
  using (public.es_tamaku_superadmin());

drop policy if exists "Superadmin registra agenda y cotizaciones" on public.tamaku_agenda_cotizaciones;
create policy "Superadmin registra agenda y cotizaciones"
  on public.tamaku_agenda_cotizaciones
  for insert to authenticated
  with check (public.es_tamaku_superadmin() and creado_por = auth.uid());

grant select, insert on public.tamaku_agenda_cotizaciones to authenticated;

commit;
