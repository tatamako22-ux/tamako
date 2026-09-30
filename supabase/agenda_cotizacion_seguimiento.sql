-- TAMAKU: clasificacion de prospectos e historial de intentos comerciales.
-- Ejecutar una vez en Supabase > SQL Editor despues de agenda_cotizacion_superadmin.sql.

begin;

alter table public.tamaku_agenda_cotizaciones
  add column if not exists tipo_registro text not null default 'BARBERIA',
  add column if not exists empresa text,
  add column if not exists sede text,
  add column if not exists intentos_previos integer not null default 0 check (intentos_previos >= 0),
  add column if not exists ultimo_medio text,
  add column if not exists ultimo_intento_en timestamptz,
  add column if not exists ultimo_resultado text,
  add column if not exists ultimo_producto_ofrecido text,
  add column if not exists notas_ultimo_intento text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tamaku_agenda_cotizaciones_tipo_registro_check'
      and conrelid = 'public.tamaku_agenda_cotizaciones'::regclass
  ) then
    alter table public.tamaku_agenda_cotizaciones
      add constraint tamaku_agenda_cotizaciones_tipo_registro_check
      check (tipo_registro in ('BARBERIA', 'EMPRESA_SEDE'));
  end if;
end $$;

create table if not exists public.tamaku_agenda_intentos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.tamaku_agenda_cotizaciones(id) on delete cascade,
  medio text not null check (medio in ('WHATSAPP', 'CORREO', 'CORREO_FISICO', 'LLAMADA', 'REUNION', 'OTRO')),
  intento_en timestamptz not null default now(),
  resultado text not null default 'PENDIENTE',
  producto_ofrecido text,
  notas text,
  proxima_accion date,
  creado_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tamaku_agenda_intentos_registro_fecha_idx
  on public.tamaku_agenda_intentos(registro_id, intento_en desc);

alter table public.tamaku_agenda_intentos enable row level security;

drop policy if exists "Superadmin consulta intentos de agenda" on public.tamaku_agenda_intentos;
create policy "Superadmin consulta intentos de agenda"
  on public.tamaku_agenda_intentos
  for select to authenticated
  using (public.es_tamaku_superadmin());

drop policy if exists "Superadmin registra intentos de agenda" on public.tamaku_agenda_intentos;
create policy "Superadmin registra intentos de agenda"
  on public.tamaku_agenda_intentos
  for insert to authenticated
  with check (public.es_tamaku_superadmin() and creado_por = auth.uid());

grant select, insert on public.tamaku_agenda_intentos to authenticated;

commit;
