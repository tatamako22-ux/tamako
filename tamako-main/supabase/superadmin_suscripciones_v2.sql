-- TAMAKU Suscripciones v2
-- Ejecutar UNA VEZ en Supabase > SQL Editor después de superadmin_suscripciones.sql.
-- Conserva tiendas, suscripciones y pagos existentes.

begin;

alter table public.tamaku_suscripciones
  add column if not exists dias_gracia integer not null default 0,
  add column if not exists mensaje_bloqueo text;

alter table public.tamaku_pagos_suscripcion
  add column if not exists periodo_desde timestamptz,
  add column if not exists periodo_hasta timestamptz;

alter table public.tamaku_suscripciones drop constraint if exists tamaku_suscripciones_dias_gracia_check;
alter table public.tamaku_suscripciones
  add constraint tamaku_suscripciones_dias_gracia_check check (dias_gracia between 0 and 90);

-- Resultado completo usado en cada inicio de sesión.
drop function if exists public.obtener_estado_suscripcion(uuid);
create function public.obtener_estado_suscripcion(p_id_tienda uuid)
returns table(
  estado text,
  estado_efectivo text,
  plan text,
  acceso boolean,
  vence timestamptz,
  dias_restantes integer,
  dias_vencido integer,
  dias_gracia integer,
  mensaje text
)
language sql stable security definer set search_path=public as $$
  with datos as (
    select s.*,
      p.codigo as codigo_plan,
      case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end as fecha_fin
    from tamaku_suscripciones s
    join tamaku_planes p on p.id=s.plan_id
    where s.id_tienda=p_id_tienda
  )
  select
    d.estado,
    case
      when d.estado in ('SUSPENDIDA','CANCELADA') then d.estado
      when d.fecha_fin is null or d.fecha_fin+(d.dias_gracia||' days')::interval <= now() then 'VENCIDA'
      else d.estado
    end,
    d.codigo_plan,
    d.estado not in ('SUSPENDIDA','CANCELADA')
      and d.fecha_fin is not null
      and d.fecha_fin+(d.dias_gracia||' days')::interval > now(),
    d.fecha_fin,
    greatest(0,ceil(extract(epoch from ((d.fecha_fin+(d.dias_gracia||' days')::interval)-now()))/86400.0)::int),
    greatest(0,floor(extract(epoch from (now()-d.fecha_fin))/86400.0)::int),
    d.dias_gracia,
    coalesce(nullif(trim(d.mensaje_bloqueo),''),nullif(trim(d.observaciones),''),
      case when d.estado='SUSPENDIDA'
        then 'Tu acceso fue suspendido. Comunícate con TAMAKU para conocer el estado de tu cuenta.'
        else 'Tu pago está vencido. Comunícate con TAMAKU y envía el comprobante para renovar el servicio.' end)
  from datos d;
$$;

-- Configura tolerancia de pago y el mensaje visible para una tienda.
create or replace function public.configurar_acceso_tamaku(
  p_tienda uuid,
  p_dias_gracia integer,
  p_mensaje text default null
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
  if p_dias_gracia < 0 or p_dias_gracia > 90 then raise exception 'Los días de gracia deben estar entre 0 y 90'; end if;
  update tamaku_suscripciones
  set dias_gracia=p_dias_gracia,
      mensaje_bloqueo=nullif(trim(p_mensaje),''),
      updated_at=now()
  where id_tienda=p_tienda;
  if not found then raise exception 'La tienda no tiene una suscripción'; end if;
end; $$;

-- Registra el pago con sus fechas reales y calcula el vencimiento.
create or replace function public.registrar_pago_manual_tamaku(
  p_tienda uuid,
  p_plan text,
  p_monto numeric,
  p_fecha_pago date,
  p_fecha_inicio date,
  p_dias integer,
  p_referencia text,
  p_notas text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_plan tamaku_planes%rowtype;
  v_pago uuid;
  v_inicio timestamptz;
  v_fin timestamptz;
begin
  if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
  if p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if p_dias < 1 or p_dias > 366 then raise exception 'La duración debe estar entre 1 y 366 días'; end if;
  if p_fecha_pago is null or p_fecha_inicio is null then raise exception 'Las fechas son obligatorias'; end if;

  select * into v_plan from tamaku_planes
  where codigo=upper(p_plan) and activo and codigo<>'PRUEBA';
  if not found then raise exception 'Plan inválido'; end if;

  -- Conserva la fecha comercial colombiana al almacenarla como timestamptz.
  v_inicio := p_fecha_inicio::timestamp at time zone 'America/Bogota';
  v_fin := v_inicio + (p_dias||' days')::interval;

  insert into tamaku_pagos_suscripcion(
    id_tienda,plan_id,monto,referencia,registrado_por,notas,
    fecha_pago,periodo_desde,periodo_hasta
  ) values (
    p_tienda,v_plan.id,p_monto,nullif(trim(p_referencia),''),auth.uid(),nullif(trim(p_notas),''),
    p_fecha_pago::timestamp at time zone 'America/Bogota',v_inicio,v_fin
  ) returning id into v_pago;

  update tamaku_suscripciones
  set plan_id=v_plan.id, plan_solicitado=v_plan.codigo, estado='ACTIVA',
      inicio_periodo=v_inicio, fin_periodo=v_fin, observaciones=null,
      updated_at=now()
  where id_tienda=p_tienda;
  if not found then raise exception 'La tienda no tiene una suscripción'; end if;

  insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda)
  values('PAGO_CONFIRMADO','Pago manual registrado',
    'Se activó '||v_plan.nombre||' hasta '||to_char(v_fin,'DD/MM/YYYY')||' por '||p_monto,p_tienda);
  return v_pago;
end; $$;

-- Conserva la firma usada por el panel, pero ahora guarda el motivo como mensaje visible.
create or replace function public.cambiar_estado_suscripcion_tamaku(
  p_tienda uuid,p_estado text,p_observacion text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare v_nombre text;
begin
  if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
  if upper(p_estado) not in('PRUEBA','ACTIVA','SUSPENDIDA','CANCELADA') then raise exception 'Estado inválido'; end if;
  update tamaku_suscripciones
  set estado=upper(p_estado), observaciones=nullif(trim(p_observacion),''),
      mensaje_bloqueo=case when upper(p_estado) in ('SUSPENDIDA','CANCELADA') then nullif(trim(p_observacion),'') else mensaje_bloqueo end,
      updated_at=now()
  where id_tienda=p_tienda;
  if not found then raise exception 'La tienda no tiene una suscripción'; end if;
  select nombre into v_nombre from tiendas where id=p_tienda;
  insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda)
  values('CAMBIO_ESTADO','Estado de tienda actualizado',coalesce(v_nombre,'Tienda')||' cambió a '||upper(p_estado),p_tienda);
end; $$;

revoke all on function public.configurar_acceso_tamaku(uuid,integer,text) from public;
revoke all on function public.registrar_pago_manual_tamaku(uuid,text,numeric,date,date,integer,text,text) from public;
grant execute on function public.obtener_estado_suscripcion(uuid) to authenticated;
grant execute on function public.configurar_acceso_tamaku(uuid,integer,text) to authenticated;
grant execute on function public.registrar_pago_manual_tamaku(uuid,text,numeric,date,date,integer,text,text) to authenticated;

commit;
