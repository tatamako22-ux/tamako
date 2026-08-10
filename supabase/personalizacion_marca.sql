-- Personalización visual por tienda. Ejecutar una vez en Supabase > SQL Editor.
begin;
alter table public.tiendas
  add column if not exists tema_base text not null default 'oscuro',
  add column if not exists color_primario text not null default '#D1A13A',
  add column if not exists color_secundario text not null default '#F0CF79',
  add column if not exists aplicar_marca_reservas boolean not null default true;
alter table public.tiendas drop constraint if exists tiendas_tema_base_check;
alter table public.tiendas add constraint tiendas_tema_base_check check (tema_base in ('oscuro','claro'));
alter table public.tiendas drop constraint if exists tiendas_color_primario_check;
alter table public.tiendas add constraint tiendas_color_primario_check check (color_primario ~ '^#[0-9A-Fa-f]{6}$');
alter table public.tiendas drop constraint if exists tiendas_color_secundario_check;
alter table public.tiendas add constraint tiendas_color_secundario_check check (color_secundario ~ '^#[0-9A-Fa-f]{6}$');
commit;
