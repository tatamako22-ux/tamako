-- Requiere planes_operacion_20261027.sql. No altera fechas ni pagos.
-- Las pruebas anteriores sin plan concreto conservan Diamante.
begin;
create or replace function public.plan_prueba_elegido_tamaku(p_codigo text)
returns uuid language sql stable security definer set search_path=public as $$
 select id from tamaku_planes where activo and codigo=case upper(coalesce(p_codigo,''))
 when 'PLATA' then 'BASICO' when 'ZAFIRO' then 'PRO' when 'DIAMANTE' then 'PREMIUM'
 when 'BASICO' then 'BASICO' when 'PRO' then 'PRO' when 'PREMIUM' then 'PREMIUM' else 'PREMIUM' end;
$$;
revoke all on function public.plan_prueba_elegido_tamaku(text) from public;
create or replace function public.obtener_estado_suscripcion(p_id_tienda uuid)
returns table(
  estado text, estado_efectivo text, plan text, plan_efectivo text,
  acceso boolean, vence timestamptz, dias_restantes integer,
  dias_vencido integer, dias_gracia integer, mensaje text,
  funcionalidades jsonb, limite_profesionales integer, limite_usuarios integer
)
language sql stable security definer set search_path=public as $$
  with datos as (
    select s.*,p.codigo codigo_plan,
      case when s.estado='PRUEBA' then elegido.codigo else p.codigo end codigo_efectivo,
      case when s.estado='PRUEBA' then elegido.funcionalidades else p.funcionalidades end funciones,
      case when s.estado='PRUEBA' then elegido.limite_profesionales else p.limite_profesionales end profesionales,
      case when s.estado='PRUEBA' then elegido.limite_usuarios else p.limite_usuarios end usuarios,
      case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end fecha_fin
    from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
    join tamaku_planes elegido on elegido.id=plan_prueba_elegido_tamaku(s.plan_solicitado)
    where s.id_tienda=tienda_principal_tamaku(p_id_tienda)
      and (es_tamaku_superadmin()
        or exists(select 1 from tiendas where id=p_id_tienda and user_id=auth.uid())
        or exists(select 1 from perfiles where tienda_id=p_id_tienda and user_id=auth.uid() and activo=true))
  )
  select d.estado,
    case when d.estado in ('SUSPENDIDA','CANCELADA') then d.estado
      when d.fecha_fin is null or d.fecha_fin+(d.dias_gracia||' days')::interval<=now() then 'VENCIDA'
      else d.estado end,
    d.codigo_plan,d.codigo_efectivo,
    coalesce(d.estado not in ('SUSPENDIDA','CANCELADA') and d.fecha_fin is not null
      and d.fecha_fin+(d.dias_gracia||' days')::interval>now()
      and (p_id_tienda=d.id_tienda or coalesce((d.funciones->>'multisede')::boolean,false)),false),
    d.fecha_fin,
    greatest(0,ceil(extract(epoch from ((d.fecha_fin+(d.dias_gracia||' days')::interval)-now()))/86400.0)::int),
    greatest(0,floor(extract(epoch from (now()-d.fecha_fin))/86400.0)::int),d.dias_gracia,
    case when p_id_tienda<>d.id_tienda and not coalesce((d.funciones->>'multisede')::boolean,false)
      then 'La administración de sedes requiere Diamante. Los datos se conservan; ingresa a la tienda principal.'
      else coalesce(nullif(trim(d.mensaje_bloqueo),''),'Comunícate con TAMAKU para renovar tu acceso.') end,
    d.funciones,d.profesionales,d.usuarios
  from datos d;
$$;

create or replace function public.validar_limite_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer; v_total integer; v_principal uuid; v_propietario uuid;
begin
  if new.activo is not true then return new; end if;
  if tg_op='UPDATE' then
    if old.activo is true and old.tienda_id=new.tienda_id and old.user_id=new.user_id then return new; end if;
  end if;
  v_principal:=tienda_principal_tamaku(new.tienda_id);
  perform pg_advisory_xact_lock(hashtextextended(v_principal::text,0));
  select case when s.estado='PRUEBA' then
    (select limite_usuarios from tamaku_planes where id=plan_prueba_elegido_tamaku(s.plan_solicitado))
    else p.limite_usuarios end into v_limite
    from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id where s.id_tienda=v_principal;
  if v_limite is null then raise exception 'Configura la suscripción antes de activar usuarios'; end if;
  select user_id into v_propietario from tiendas where id=v_principal;
  v_total:=total_usuarios_plan_tamaku(v_principal,new.id);
  if new.user_id is distinct from v_propietario and not exists(
    select 1 from perfiles where tienda_principal_tamaku(tienda_id)=v_principal
      and activo=true and user_id=new.user_id and id<>new.id
  ) then v_total:=v_total+1; end if;
  if v_total>v_limite then raise exception 'El plan permite % usuarios activos entre todas las sedes, incluido el propietario.',v_limite; end if;
  return new;
end; $$;

create or replace function public.validar_cambio_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer; v_total integer;
begin
  if new.plan_id=old.plan_id and new.plan_solicitado is not distinct from old.plan_solicitado and new.estado in ('SUSPENDIDA','CANCELADA') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_tienda::text,0));
  select case when new.estado='PRUEBA' then
    (select limite_usuarios from tamaku_planes where id=plan_prueba_elegido_tamaku(new.plan_solicitado))
    else limite_usuarios end into v_limite from tamaku_planes where id=new.plan_id and activo;
  if v_limite is null then raise exception 'Plan sin límite de usuarios configurado'; end if;
  v_total:=total_usuarios_plan_tamaku(new.id_tienda);
  if v_total>v_limite then
    raise exception 'El plan admite % usuarios incluido el propietario; actualmente hay % accesos activos distintos entre la tienda y sus sedes. Revisa Usuarios, no Profesionales, y desactiva los accesos sobrantes antes de cambiarlo.',v_limite,v_total;
  end if;
  return new;
end; $$;

create or replace function public.seleccionar_plan_tamaku(p_tienda uuid,p_plan text)
returns void language plpgsql security definer set search_path=public as $$
declare v_codigo text;
begin
  if not exists(select 1 from tiendas where id=p_tienda and user_id=auth.uid()) then
    raise exception 'Solo el propietario puede seleccionar el plan solicitado';
  end if;
  v_codigo:=case upper(trim(p_plan)) when 'PLATA' then 'BASICO' when 'ZAFIRO' then 'PRO'
    when 'DIAMANTE' then 'PREMIUM' else upper(trim(p_plan)) end;
  if not exists(select 1 from tamaku_planes where codigo=v_codigo and activo and codigo<>'PRUEBA') then raise exception 'Plan inválido'; end if;
  update tamaku_suscripciones set plan_solicitado=v_codigo,updated_at=now() where id_tienda=p_tienda;
end; $$;
drop trigger if exists trg_validar_cambio_plan_tamaku on public.tamaku_suscripciones;
create trigger trg_validar_cambio_plan_tamaku before update of plan_id,estado,plan_solicitado
on public.tamaku_suscripciones for each row
when (old.plan_id is distinct from new.plan_id or old.estado is distinct from new.estado or old.plan_solicitado is distinct from new.plan_solicitado)
execute function public.validar_cambio_plan_tamaku();

create or replace function public.crear_prueba_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan uuid;
begin
 select id into v_plan from tamaku_planes where codigo='PRUEBA';
 insert into tamaku_suscripciones(id_tienda,plan_id,plan_solicitado) values(new.id,v_plan,'BASICO') on conflict(id_tienda) do nothing;
 insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda)
 values('NUEVA_PRUEBA','Nueva tienda en prueba',new.nombre||' inicio una prueba de 7 dias del plan elegido.',new.id);
 return new;
end; $$;
notify pgrst,'reload schema';
commit;
