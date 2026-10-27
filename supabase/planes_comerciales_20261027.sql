-- Ejecutar DESPUÉS de planes_capacidades.sql y superadmin_suscripciones_v2.sql.
-- Mantiene BASICO / PRO / PREMIUM y sus UUID para conservar pagos y relaciones.
begin;

update public.tamaku_planes p set
  nombre=v.nombre, precio_mensual=v.precio, limite_usuarios=v.usuarios,
  limite_profesionales=null,
  funcionalidades=jsonb_build_object(
    'dashboard',true,'agenda',true,'clientes',true,'profesionales',true,
    'facturacion',true,'caja',true,'ajustes',true,'usuarios',true,
    'reportes',v.codigo<>'BASICO','marketing',v.codigo<>'BASICO',
    'crm_avanzado',v.codigo in ('PREMIUM','PRUEBA'),
    'multisede',v.codigo in ('PREMIUM','PRUEBA'),
    'tienda',v.codigo in ('PREMIUM','PRUEBA'),'servicio_cliente',true)
from (values ('BASICO','Plata',69900,1),('PRO','Zafiro',119900,3),
  ('PREMIUM','Diamante',199000,10),('PRUEBA','Prueba Diamante 7 días',0,10))
  as v(codigo,nombre,precio,usuarios)
where p.codigo=v.codigo;

-- Cuenta al propietario una sola vez, tenga o no perfil, y no cuenta inactivos.
create or replace function public.total_usuarios_plan_tamaku(p_tienda uuid, p_excluir uuid default null)
returns integer language sql volatile security definer set search_path=public as $$
  select count(*)::integer from (
    select user_id from tiendas where id=p_tienda
    union
    select user_id from perfiles where tienda_id=p_tienda and activo=true
      and (p_excluir is null or id<>p_excluir)
  ) usuarios where user_id is not null;
$$;
revoke all on function public.total_usuarios_plan_tamaku(uuid,uuid) from public;

create or replace function public.validar_limite_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer; v_total integer; v_propietario uuid;
begin
  if tg_table_name<>'perfiles' or new.activo is not true then return new; end if;
  if tg_op='UPDATE' then
    if old.activo is true and old.tienda_id=new.tienda_id and old.user_id=new.user_id then return new; end if;
  end if;
  -- Serializa altas, reactivaciones y cambios de plan de la misma tienda.
  perform pg_advisory_xact_lock(hashtextextended(new.tienda_id::text,0));
  select case when s.estado='PRUEBA' then 10 else p.limite_usuarios end
    into v_limite from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
    where s.id_tienda=new.tienda_id;
  if v_limite is null then raise exception 'Configura la suscripción antes de activar usuarios'; end if;
  select user_id into v_propietario from tiendas where id=new.tienda_id;
  v_total:=total_usuarios_plan_tamaku(new.tienda_id,new.id);
  if new.user_id is distinct from v_propietario and not exists(
    select 1 from perfiles where tienda_id=new.tienda_id and activo=true
      and user_id=new.user_id and id<>new.id
  ) then v_total:=v_total+1; end if;
  if v_total>v_limite then
    raise exception 'Este plan permite % usuarios activos, incluido el propietario. Desactiva un acceso o cambia de plan.',v_limite;
  end if;
  return new;
end; $$;

drop trigger if exists trg_limite_profesionales_plan on public.profesionales;
drop trigger if exists trg_limite_usuarios_plan on public.perfiles;
create trigger trg_limite_usuarios_plan before insert or update of activo,tienda_id,user_id
on public.perfiles for each row execute function public.validar_limite_plan_tamaku();

-- También protege cambios hechos a través del registro de pagos manuales.
create or replace function public.validar_cambio_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer;
begin
  if new.plan_id=old.plan_id and new.estado in ('SUSPENDIDA','CANCELADA') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_tienda::text,0));
  select case when new.estado='PRUEBA' then 10 else limite_usuarios end
    into v_limite from tamaku_planes where id=new.plan_id and activo;
  if v_limite is null then raise exception 'Plan sin límite de usuarios configurado'; end if;
  if total_usuarios_plan_tamaku(new.id_tienda)>v_limite then
    raise exception 'El plan admite % usuarios incluido el propietario. Desactiva los accesos sobrantes antes de cambiarlo.',v_limite;
  end if;
  return new;
end; $$;
drop trigger if exists trg_validar_cambio_plan_tamaku on public.tamaku_suscripciones;
create trigger trg_validar_cambio_plan_tamaku before update of plan_id,estado
on public.tamaku_suscripciones for each row
when (old.plan_id is distinct from new.plan_id or old.estado is distinct from new.estado)
execute function public.validar_cambio_plan_tamaku();

create or replace function public.cambiar_plan_tamaku(p_tienda uuid,p_plan text)
returns void language plpgsql security definer set search_path=public as $$
declare v_plan tamaku_planes%rowtype; v_suscripcion tamaku_suscripciones%rowtype; v_codigo text;
begin
  if not es_tamaku_superadmin() then raise exception 'Solo el superadministrador puede cambiar planes'; end if;
  v_codigo:=case upper(trim(p_plan)) when 'PLATA' then 'BASICO' when 'ZAFIRO' then 'PRO'
    when 'DIAMANTE' then 'PREMIUM' else upper(trim(p_plan)) end;
  select * into v_plan from tamaku_planes where codigo=v_codigo and activo and codigo<>'PRUEBA';
  if not found then raise exception 'Plan inválido'; end if;
  select * into v_suscripcion from tamaku_suscripciones where id_tienda=p_tienda for update;
  if not found then raise exception 'No existe suscripción para esta tienda'; end if;
  update tamaku_suscripciones set
    plan_id=case when estado='PRUEBA' then plan_id else v_plan.id end,
    plan_solicitado=v_plan.codigo,updated_at=now()
  where id_tienda=p_tienda;
  insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda)
    values('CAMBIO_PLAN','Cambio de plan',
      case when v_suscripcion.estado='PRUEBA' then 'Plan solicitado: ' else 'Plan actualizado: ' end
      ||v_plan.nombre||'. Por administrador '||auth.uid()::text||'. Se conserva el vencimiento.',p_tienda);
end; $$;
revoke all on function public.cambiar_plan_tamaku(uuid,text) from public;
grant execute on function public.cambiar_plan_tamaku(uuid,text) to authenticated;

create or replace function public.seleccionar_plan_tamaku(p_tienda uuid,p_plan text)
returns void language plpgsql security definer set search_path=public as $$
declare v_codigo text;
begin
  if not exists(select 1 from tiendas where id=p_tienda and user_id=auth.uid()) then
    raise exception 'Solo el propietario puede seleccionar el plan solicitado';
  end if;
  v_codigo:=case upper(trim(p_plan)) when 'PLATA' then 'BASICO' when 'ZAFIRO' then 'PRO'
    when 'DIAMANTE' then 'PREMIUM' else upper(trim(p_plan)) end;
  if not exists(select 1 from tamaku_planes where codigo=v_codigo and activo) then raise exception 'Plan inválido'; end if;
  update tamaku_suscripciones set plan_solicitado=v_codigo,updated_at=now() where id_tienda=p_tienda;
end; $$;

-- El permiso comercial requiere una suscripción vigente y pertenencia a la tienda.
create or replace function public.plan_tiene_funcion(p_tienda uuid,p_funcion text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(bool_or(
    (p.funcionalidades->>p_funcion)::boolean
    and s.estado not in ('SUSPENDIDA','CANCELADA')
    and (case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end)
      + (s.dias_gracia||' days')::interval>now()
  ),false)
  from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
  where s.id_tienda=p_tienda and (
    es_tamaku_superadmin() or exists(select 1 from tiendas where id=p_tienda and user_id=auth.uid())
    or exists(select 1 from perfiles where tienda_id=p_tienda and user_id=auth.uid() and activo=true)
  );
$$;

commit;
