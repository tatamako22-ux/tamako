-- Migracion aditiva. Ejecutar primero en un entorno de prueba.
-- SECURITY INVOKER conserva las politicas RLS del usuario; NO desactivar RLS.
-- No modifica datos, precios, permisos ni funciones existentes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Detener la migracion si no se cumplen las precondiciones de aislamiento.
do $$
declare nombre text;
begin
  foreach nombre in array array['citas','facturas','profesionales','perfiles_clientes','clientes_bloqueados'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = nombre and c.relrowsecurity) then
      raise exception 'Se requiere RLS activo en public.% antes de instalar los resumenes', nombre;
    end if;
  end loop;
  if to_regprocedure('public.pertenece_a_tienda(uuid)') is null then
    raise exception 'Falta pertenece_a_tienda(uuid); revisar la migracion de integridad de reservas';
  end if;
end $$;

create or replace function public.tamaku_visitas_clientes_v1(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_object_agg(t.telefono, t.visitas), '{}'::jsonb)
  from (
    select right(regexp_replace(coalesce(telefono_cliente, ''), '[^0-9]', '', 'g'), 10) as telefono,
           count(*) as visitas
    from public.citas where id_tienda = p_tienda and auth.uid() is not null and public.pertenece_a_tienda(p_tienda)
    group by 1
  ) t where t.telefono <> '';
$$;

create or replace function public.tamaku_clientes_pagina_v1(
  p_tienda uuid, p_busqueda text default '', p_categoria text default 'todos',
  p_offset integer default 0, p_limite integer default 50
) returns jsonb language sql stable security invoker set search_path = public
as $$
with base as materialized (
  select regexp_replace(coalesce(c.telefono_cliente, ''), '[^0-9]', '', 'g') as telefono,
    c.nombre_cliente, c.email_cliente, c.fecha, c.valor_servicio, c.id_cita
  from public.citas c where c.id_tienda = p_tienda and auth.uid() is not null and public.pertenece_a_tienda(p_tienda)
), clientes as materialized (
  select telefono,
    coalesce((array_agg(nombre_cliente order by fecha desc nulls last, id_cita desc))[1], 'CLIENTE') as nombre,
    coalesce((array_agg(email_cliente order by fecha desc nulls last, id_cita desc)
      filter (where position('@' in email_cliente) > 0))[1], 'Sin correo') as email,
    count(*) as visitas, coalesce(sum(valor_servicio), 0) as gastado, max(fecha) as ultima_fecha
  from base where telefono <> '' group by telefono
), filtrados as (
  select * from clientes where
    (coalesce(p_busqueda, '') = '' or strpos(lower(nombre || ' ' || telefono), lower(trim(p_busqueda))) > 0)
    and (p_categoria = 'todos' or (p_categoria = 'vip' and visitas >= 5)
      or (p_categoria = 'frecuentes' and visitas < 5)
      or (p_categoria = 'nuevos' and date_trunc('month', ultima_fecha::timestamp) = date_trunc('month', now() at time zone 'America/Bogota')))
), pagina as (
  select * from filtrados order by lower(nombre), telefono
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
), bloqueos as materialized (
  select b.id, b.telefono_cliente, b.tipo_bloqueo, b.id_barbero,
    jsonb_build_object('nombre_empleado', p.nombre_empleado) as profesionales
  from public.clientes_bloqueados b left join public.profesionales p on p.id_barbero = b.id_barbero and p.id_tienda = b.id_tienda
  where b.id_tienda = p_tienda and auth.uid() is not null and public.pertenece_a_tienda(p_tienda)
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'telefono', a.telefono, 'nombre', a.nombre, 'email', a.email,
    'visitas', a.visitas, 'gastado', a.gastado, 'ultimaFecha', a.ultima_fecha,
    'bloqueos', coalesce((select jsonb_agg(to_jsonb(b)) from bloqueos b
      where right(regexp_replace(b.telefono_cliente, '[^0-9]', '', 'g'), 10) = right(a.telefono, 10)), '[]'::jsonb)
  ) order by lower(a.nombre), a.telefono) from pagina a), '[]'::jsonb),
  'total', (select count(*) from filtrados),
  'metrics', (select jsonb_build_object('totalClientes', count(*),
    'clientesVip', count(*) filter(where visitas >= 5),
    'clientesFrecuentes', count(*) filter(where visitas < 5),
    'clientesNuevos', count(*) filter(where date_trunc('month', ultima_fecha::timestamp) = date_trunc('month', now() at time zone 'America/Bogota')),
    'totalBloqueados', (select count(distinct right(regexp_replace(telefono_cliente, '[^0-9]', '', 'g'), 10)) from bloqueos)) from clientes)
);
$$;

create or replace function public.tamaku_facturas_pagina_v1(
  p_tienda uuid, p_busqueda text default '', p_estado text default '', p_metodo text default '',
  p_offset integer default 0, p_limite integer default 50
) returns jsonb language sql stable security invoker set search_path = public
as $$
with base as materialized (
  select f.id_factura, f.id_cita, f.id_barbero, f.id_metodo_pago, f.fecha_emision,
    f.metodo_pago, f.destino_pago, f.estado, f.total, f.notas,
    jsonb_build_object('nombre_empleado', p.nombre_empleado) as profesionales,
    jsonb_build_object('nombre_completo', c.nombre_completo) as perfiles_clientes
  from public.facturas f
  left join public.profesionales p on p.id_barbero = f.id_barbero and p.id_tienda = f.id_tienda
  left join public.perfiles_clientes c on c.id = f.id_cliente
  where f.id_tienda = p_tienda and auth.uid() is not null and public.pertenece_a_tienda(p_tienda)
), filtrados as (
  select * from base where
    (coalesce(p_busqueda, '') = '' or strpos(lower(concat_ws(' ', perfiles_clientes->>'nombre_completo', profesionales->>'nombre_empleado', metodo_pago)), lower(trim(p_busqueda))) > 0)
    and (coalesce(p_estado, '') = '' or upper(estado) = p_estado)
    and (coalesce(p_metodo, '') = '' or metodo_pago = p_metodo)
), pagina as (
  select * from filtrados order by fecha_emision desc nulls last, id_factura desc
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(p) order by fecha_emision desc nulls last, id_factura desc) from pagina p), '[]'::jsonb),
  'total', (select count(*) from filtrados),
  'metodos', coalesce((select jsonb_agg(metodo_pago order by metodo_pago) from (select distinct metodo_pago from base where coalesce(metodo_pago, '') <> '') m), '[]'::jsonb),
  'metrics', (select jsonb_build_object('cantidadFacturas', count(*),
    'facturasPendientes', count(*) filter(where upper(estado) = 'PENDIENTE'),
    'ventasHoy', coalesce(sum(total) filter(where upper(estado) = 'PAGADA' and fecha_emision >= ((now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota')), 0),
    'totalMes', coalesce(sum(total) filter(where upper(estado) = 'PAGADA' and fecha_emision >= (date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota')), 0)) from base)
);
$$;

create or replace function public.tamaku_conteo_agenda_v1(
  p_tienda uuid, p_desde date, p_hasta date, p_profesional uuid default null
) returns jsonb language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_object_agg(fecha::text, total), '{}'::jsonb) from (
    select fecha, count(*) as total from public.citas
    where id_tienda = p_tienda and fecha between p_desde and p_hasta
      and estado <> 'CANCELADA' and (p_profesional is null or id_barbero = p_profesional)
      and auth.uid() is not null and public.pertenece_a_tienda(p_tienda)
    group by fecha
  ) dias;
$$;

revoke all on function public.tamaku_conteo_agenda_v1(uuid,date,date,uuid) from public, anon;
grant execute on function public.tamaku_conteo_agenda_v1(uuid,date,date,uuid) to authenticated;
revoke all on function public.tamaku_visitas_clientes_v1(uuid) from public, anon;
revoke all on function public.tamaku_clientes_pagina_v1(uuid,text,text,integer,integer) from public, anon;
revoke all on function public.tamaku_facturas_pagina_v1(uuid,text,text,text,integer,integer) from public, anon;
grant execute on function public.tamaku_visitas_clientes_v1(uuid) to authenticated;
grant execute on function public.tamaku_clientes_pagina_v1(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.tamaku_facturas_pagina_v1(uuid,text,text,text,integer,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
