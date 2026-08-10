-- Edición y eliminación segura de cuentas financieras por propietarios/administradores.
-- Ejecutar una vez en Supabase > SQL Editor, después de insumos_y_permisos_facturas.sql.
begin;

create or replace function public.editar_cuenta_financiera_tienda(
  p_id_tienda uuid, p_id_cuenta uuid, p_nombre text, p_tipo text
) returns void language plpgsql security definer set search_path=public as $$
declare v_nombre text:=trim(p_nombre); v_tipo text:=upper(trim(p_tipo));
begin
  if not (
    exists(select 1 from tiendas where id=p_id_tienda and user_id=auth.uid())
    or exists(select 1 from perfiles where tienda_id=p_id_tienda and user_id=auth.uid() and activo=true and coalesce((permisos->>'cuentas_gestionar')::boolean,false))
  ) then raise exception 'No tienes permiso para gestionar cuentas'; end if;
  if v_nombre='' then raise exception 'El nombre es obligatorio'; end if;
  if v_tipo not in('EFECTIVO','DIGITAL','BANCO','TARJETA','OTRO') then raise exception 'Tipo de cuenta inválido'; end if;
  if exists(select 1 from cuentas_financieras where id_tienda=p_id_tienda and activa=true and id<>p_id_cuenta and lower(trim(nombre))=lower(v_nombre)) then
    raise exception 'Ya existe otra cuenta con ese nombre';
  end if;
  update cuentas_financieras set nombre=v_nombre,tipo=v_tipo where id=p_id_cuenta and id_tienda=p_id_tienda and activa=true;
  if not found then raise exception 'La cuenta no existe o ya fue eliminada'; end if;
  update metodos_pago set nombre=v_nombre where id_tienda=p_id_tienda and id_cuenta=p_id_cuenta;
end $$;

create or replace function public.eliminar_cuenta_financiera_tienda(
  p_id_tienda uuid, p_id_cuenta uuid
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not (
    exists(select 1 from tiendas where id=p_id_tienda and user_id=auth.uid())
    or exists(select 1 from perfiles where tienda_id=p_id_tienda and user_id=auth.uid() and activo=true and coalesce((permisos->>'cuentas_gestionar')::boolean,false))
  ) then raise exception 'No tienes permiso para gestionar cuentas'; end if;
  if exists(select 1 from cajas_sesiones where id_tienda=p_id_tienda and id_cuenta=p_id_cuenta and estado='ABIERTA') then
    raise exception 'Cierra primero la caja asociada a esta cuenta';
  end if;
  update cuentas_financieras set activa=false where id=p_id_cuenta and id_tienda=p_id_tienda and activa=true;
  if not found then raise exception 'La cuenta no existe o ya fue eliminada'; end if;
  update metodos_pago set activo=false where id_tienda=p_id_tienda and id_cuenta=p_id_cuenta;
end $$;

revoke all on function public.editar_cuenta_financiera_tienda(uuid,uuid,text,text) from public;
revoke all on function public.eliminar_cuenta_financiera_tienda(uuid,uuid) from public;
grant execute on function public.editar_cuenta_financiera_tienda(uuid,uuid,text,text) to authenticated;
grant execute on function public.eliminar_cuenta_financiera_tienda(uuid,uuid) to authenticated;
commit;
