-- TAMAKU: capacidades y límites reales por plan.
-- Ejecutar una vez en Supabase > SQL Editor después de los scripts de suscripciones.

begin;

alter table public.tamaku_planes
  add column if not exists funcionalidades jsonb not null default '{}'::jsonb,
  add column if not exists limite_profesionales integer,
  add column if not exists limite_usuarios integer;

update public.tamaku_planes set
  nombre='Prueba Premium 7 días', precio_mensual=0, dias_vigencia=7,
  funcionalidades='{"dashboard":true,"agenda":true,"clientes":true,"profesionales":true,"facturacion":true,"caja":true,"reportes":true,"usuarios":true,"tienda":true,"ajustes":true}'::jsonb,
  limite_profesionales=20, limite_usuarios=10
where codigo='PRUEBA';

update public.tamaku_planes set
  nombre='Plan Básico', precio_mensual=29900, dias_vigencia=30,
  funcionalidades='{"dashboard":true,"agenda":true,"clientes":true,"profesionales":true,"facturacion":false,"caja":false,"reportes":false,"usuarios":false,"tienda":false,"ajustes":true}'::jsonb,
  limite_profesionales=2, limite_usuarios=1
where codigo='BASICO';

update public.tamaku_planes set
  nombre='Plan Pro', precio_mensual=59900, dias_vigencia=30,
  funcionalidades='{"dashboard":true,"agenda":true,"clientes":true,"profesionales":true,"facturacion":true,"caja":true,"reportes":true,"usuarios":true,"tienda":false,"ajustes":true}'::jsonb,
  limite_profesionales=6, limite_usuarios=3
where codigo='PRO';

update public.tamaku_planes set
  nombre='Plan Premium', precio_mensual=99900, dias_vigencia=30,
  funcionalidades='{"dashboard":true,"agenda":true,"clientes":true,"profesionales":true,"facturacion":true,"caja":true,"reportes":true,"usuarios":true,"tienda":true,"ajustes":true}'::jsonb,
  limite_profesionales=20, limite_usuarios=10
where codigo='PREMIUM';

create or replace function public.plan_tiene_funcion(p_tienda uuid,p_funcion text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((p.funcionalidades->>p_funcion)::boolean,false)
  from tamaku_suscripciones s
  join tamaku_planes p on p.id=s.plan_id
  where s.id_tienda=p_tienda;
$$;

create or replace function public.validar_limite_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer; v_total integer; v_tienda uuid;
begin
  v_tienda:=coalesce(
    (to_jsonb(new)->>'id_tienda')::uuid,
    (to_jsonb(new)->>'tienda_id')::uuid
  );
  select case when s.estado='PRUEBA' then 20
              when tg_table_name='profesionales' then p.limite_profesionales
              else p.limite_usuarios end
  into v_limite from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
  where s.id_tienda=v_tienda;
  if v_limite is null then return new; end if;
  if tg_table_name='profesionales' then
    select count(*) into v_total from profesionales where id_tienda=v_tienda;
    if v_total>=v_limite then raise exception 'Tu plan permite máximo % profesionales',v_limite; end if;
  else
    select count(*) into v_total from perfiles where tienda_id=v_tienda and activo=true;
    if v_total>=v_limite then raise exception 'Tu plan permite máximo % usuarios activos',v_limite; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_limite_profesionales_plan on public.profesionales;
create trigger trg_limite_profesionales_plan before insert on public.profesionales
for each row execute function public.validar_limite_plan_tamaku();

drop trigger if exists trg_limite_usuarios_plan on public.perfiles;
create trigger trg_limite_usuarios_plan before insert on public.perfiles
for each row execute function public.validar_limite_plan_tamaku();

drop function if exists public.obtener_estado_suscripcion(uuid);
create function public.obtener_estado_suscripcion(p_id_tienda uuid)
returns table(
  estado text, estado_efectivo text, plan text, plan_efectivo text,
  acceso boolean, vence timestamptz, dias_restantes integer,
  dias_vencido integer, dias_gracia integer, mensaje text,
  funcionalidades jsonb, limite_profesionales integer, limite_usuarios integer
)
language sql stable security definer set search_path=public as $$
  with datos as (
    select s.*,p.codigo codigo_plan,p.funcionalidades,p.limite_profesionales,p.limite_usuarios,
      case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end fecha_fin
    from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
    where s.id_tienda=p_id_tienda
  )
  select d.estado,
    case when d.estado in('SUSPENDIDA','CANCELADA') then d.estado
      when d.fecha_fin is null or d.fecha_fin+(d.dias_gracia||' days')::interval<=now() then 'VENCIDA'
      else d.estado end,
    d.codigo_plan,case when d.estado='PRUEBA' then 'PREMIUM' else d.codigo_plan end,
    d.estado not in('SUSPENDIDA','CANCELADA') and d.fecha_fin is not null
      and d.fecha_fin+(d.dias_gracia||' days')::interval>now(),
    d.fecha_fin,
    greatest(0,ceil(extract(epoch from ((d.fecha_fin+(d.dias_gracia||' days')::interval)-now()))/86400.0)::int),
    greatest(0,floor(extract(epoch from (now()-d.fecha_fin))/86400.0)::int),
    d.dias_gracia,
    coalesce(nullif(trim(d.mensaje_bloqueo),''),nullif(trim(d.observaciones),''),
      'Tu plan está vencido. Comunícate con TAMAKU para renovar el servicio.'),
    d.funcionalidades,d.limite_profesionales,d.limite_usuarios
  from datos d;
$$;

revoke all on function public.plan_tiene_funcion(uuid,text) from public;
grant execute on function public.plan_tiene_funcion(uuid,text) to authenticated;
grant execute on function public.obtener_estado_suscripcion(uuid) to authenticated;

commit;
