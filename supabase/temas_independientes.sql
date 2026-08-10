-- Permite elegir por separado el modo del tablero y el de la página de reservas.
-- Ejecutar una vez en Supabase > SQL Editor.
begin;
do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tiendas' and column_name='tema_panel') then
    alter table public.tiendas add column tema_panel text not null default 'oscuro';
    update public.tiendas set tema_panel=coalesce(tema_base,'oscuro');
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tiendas' and column_name='tema_reservas') then
    alter table public.tiendas add column tema_reservas text not null default 'oscuro';
    update public.tiendas set tema_reservas=coalesce(tema_base,'oscuro');
  end if;
end $$;
alter table public.tiendas drop constraint if exists tiendas_tema_panel_check;
alter table public.tiendas add constraint tiendas_tema_panel_check check(tema_panel in('oscuro','claro'));
alter table public.tiendas drop constraint if exists tiendas_tema_reservas_check;
alter table public.tiendas add constraint tiendas_tema_reservas_check check(tema_reservas in('oscuro','claro'));
commit;
