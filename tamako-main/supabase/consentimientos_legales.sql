-- TAMAKU | Evidencia de consentimientos legales
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- No modifica tablas existentes ni sus datos.

create extension if not exists pgcrypto;

create table if not exists public.consentimientos_legales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  documento text not null check (documento in ('politica_datos', 'terminos')),
  version text not null,
  aceptado boolean not null default true,
  aceptado_en timestamptz not null default now(),
  origen text not null,
  tienda_id uuid null references public.tiendas(id) on delete set null,
  marketing_autorizado boolean not null default false,
  navegador text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint consentimientos_legales_evidencia_unica
    unique (user_id, documento, version, origen)
);

create index if not exists consentimientos_legales_user_id_idx
  on public.consentimientos_legales(user_id, aceptado_en desc);

create index if not exists consentimientos_legales_tienda_id_idx
  on public.consentimientos_legales(tienda_id, aceptado_en desc)
  where tienda_id is not null;

alter table public.consentimientos_legales enable row level security;

drop policy if exists "Titular consulta sus consentimientos" on public.consentimientos_legales;
create policy "Titular consulta sus consentimientos"
on public.consentimientos_legales for select
to authenticated
using (auth.uid() = user_id);

-- No se crean políticas UPDATE ni DELETE: la evidencia no puede alterarse desde el cliente.

create or replace function public.registrar_consentimiento_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  version_doc text := coalesce(nullif(datos->>'politica_datos_version', ''), '2026-08-09');
  origen_doc text := coalesce(nullif(datos->>'origen_consentimiento', ''), 'registro');
  tienda_doc uuid;
begin
  begin
    tienda_doc := nullif(datos->>'tienda_id_consentimiento', '')::uuid;
  exception when invalid_text_representation then
    tienda_doc := null;
  end;

  if coalesce((datos->>'acepta_politica_datos')::boolean, false) then
    insert into public.consentimientos_legales
      (user_id, documento, version, aceptado_en, origen, tienda_id,
       marketing_autorizado, navegador, metadata)
    values
      (new.id, 'politica_datos', version_doc,
       coalesce(nullif(datos->>'politica_datos_aceptada_en', '')::timestamptz, now()),
       origen_doc, tienda_doc,
       coalesce((datos->>'acepta_marketing')::boolean, false),
       left(datos->>'navegador_consentimiento', 500),
       jsonb_build_object('email_confirmado', new.email_confirmed_at is not null))
    on conflict do nothing;
  end if;

  if coalesce((datos->>'acepta_terminos')::boolean, false) then
    insert into public.consentimientos_legales
      (user_id, documento, version, aceptado_en, origen, tienda_id,
       marketing_autorizado, navegador)
    values
      (new.id, 'terminos',
       coalesce(nullif(datos->>'terminos_version', ''), version_doc),
       coalesce(nullif(datos->>'politica_datos_aceptada_en', '')::timestamptz, now()),
       origen_doc, tienda_doc,
       coalesce((datos->>'acepta_marketing')::boolean, false),
       left(datos->>'navegador_consentimiento', 500))
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists guardar_consentimiento_al_registrar on auth.users;
create trigger guardar_consentimiento_al_registrar
after insert on auth.users
for each row execute function public.registrar_consentimiento_nuevo_usuario();

comment on table public.consentimientos_legales is
'Evidencia inmutable de autorizaciones legales otorgadas al crear cuentas TAMAKU.';
