-- TAMAKU | Tablón público por tienda.
-- Ejecutar una vez en Supabase > SQL Editor antes de publicar esta versión.
begin;

alter table public.tiendas
  add column if not exists tablon_activo boolean not null default false,
  add column if not exists tablon_tipo text not null default 'aviso',
  add column if not exists tablon_titulo text,
  add column if not exists tablon_mensaje text,
  add column if not exists tablon_imagen_url text,
  add column if not exists tablon_boton_texto text,
  add column if not exists tablon_boton_url text,
  add column if not exists tablon_desde timestamptz,
  add column if not exists tablon_hasta timestamptz;

alter table public.tiendas drop constraint if exists tiendas_tablon_tipo_check;
alter table public.tiendas add constraint tiendas_tablon_tipo_check
  check (tablon_tipo in ('aviso', 'promocion', 'importante'));
alter table public.tiendas drop constraint if exists tiendas_tablon_titulo_longitud_check;
alter table public.tiendas add constraint tiendas_tablon_titulo_longitud_check
  check (char_length(tablon_titulo) <= 80);
alter table public.tiendas drop constraint if exists tiendas_tablon_mensaje_longitud_check;
alter table public.tiendas add constraint tiendas_tablon_mensaje_longitud_check
  check (char_length(tablon_mensaje) <= 600);
alter table public.tiendas drop constraint if exists tiendas_tablon_fechas_check;
alter table public.tiendas add constraint tiendas_tablon_fechas_check
  check (tablon_desde is null or tablon_hasta is null or tablon_desde < tablon_hasta);

commit;
