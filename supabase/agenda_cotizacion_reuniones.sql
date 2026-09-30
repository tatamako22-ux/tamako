-- TAMAKU: reuniones comerciales vinculadas a empresas o barberias.
-- Ejecutar en Supabase > SQL Editor despues de agenda_cotizacion_seguimiento.sql.

begin;

alter table public.tamaku_agenda_intentos
  add column if not exists informacion_enviada text;

create table if not exists public.tamaku_agenda_reuniones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.tamaku_agenda_cotizaciones(id) on delete cascade,
  fecha_reunion timestamptz not null,
  lugar text,
  asistentes text,
  producto_ofrecido text,
  estado text not null default 'PROGRAMADA' check (estado in ('PROGRAMADA', 'REALIZADA', 'CANCELADA')),
  resultado text,
  notas text,
  proxima_accion date,
  creado_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tamaku_agenda_reuniones_registro_fecha_idx
  on public.tamaku_agenda_reuniones(registro_id, fecha_reunion desc);

alter table public.tamaku_agenda_reuniones enable row level security;

drop policy if exists "Superadmin consulta reuniones de agenda" on public.tamaku_agenda_reuniones;
create policy "Superadmin consulta reuniones de agenda"
  on public.tamaku_agenda_reuniones
  for select to authenticated
  using (public.es_tamaku_superadmin());

drop policy if exists "Superadmin registra reuniones de agenda" on public.tamaku_agenda_reuniones;
create policy "Superadmin registra reuniones de agenda"
  on public.tamaku_agenda_reuniones
  for insert to authenticated
  with check (public.es_tamaku_superadmin() and creado_por = auth.uid());

grant select, insert on public.tamaku_agenda_reuniones to authenticated;

commit;
