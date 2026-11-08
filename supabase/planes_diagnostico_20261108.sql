-- Ejecutar despues de planes_operacion_20261027.sql. No cambia planes ni accesos.
begin;
create or replace function public.validar_cambio_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer; v_total integer;
begin
  if new.plan_id=old.plan_id and new.estado in ('SUSPENDIDA','CANCELADA') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_tienda::text,0));
  select case when new.estado='PRUEBA' then
    (select limite_usuarios from tamaku_planes where activo and codigo<>'PRUEBA' order by precio_mensual desc,codigo limit 1)
    else limite_usuarios end into v_limite from tamaku_planes where id=new.plan_id and activo;
  if v_limite is null then raise exception 'Plan sin límite de usuarios configurado'; end if;
  v_total:=total_usuarios_plan_tamaku(new.id_tienda);
  if v_total>v_limite then
    raise exception 'El plan admite % usuarios incluido el propietario; actualmente hay % accesos activos distintos entre la tienda y sus sedes. Revisa Usuarios, no Profesionales, y desactiva los accesos sobrantes antes de cambiarlo.',v_limite,v_total;
  end if;
  return new;
end; $$;

notify pgrst,'reload schema';
commit;
