-- TAMAKU: corrección segura del método de pago de una factura.
-- No crea tablas ni columnas. Reutiliza facturas, métodos, cuentas, movimientos y cajas.
-- Ejecutar una vez en Supabase > SQL Editor.

create or replace function public.corregir_metodo_pago_factura(
  p_factura uuid,
  p_metodo_nuevo uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_factura facturas%rowtype;
  v_movimiento movimientos_financieros%rowtype;
  v_metodo metodos_pago%rowtype;
  v_cuenta_anterior numeric(12,2);
  v_cuenta_nueva numeric(12,2);
  v_caja_nueva uuid;
  v_marca text;
begin
  select * into v_factura from facturas where id_factura=p_factura for update;
  if not found then raise exception 'La factura no existe'; end if;
  if not tiene_permiso_tienda(v_factura.id_tienda,'facturas_crear') then
    raise exception 'No tienes permiso para corregir esta factura';
  end if;
  if upper(coalesce(v_factura.estado,'')) <> 'PAGADA' then
    raise exception 'Solo se puede corregir el método de una factura pagada';
  end if;

  select * into v_metodo from metodos_pago
  where id_metodo=p_metodo_nuevo and id_tienda=v_factura.id_tienda and activo=true;
  if not found or v_metodo.id_cuenta is null then
    raise exception 'El método nuevo no es válido o no tiene cuenta asociada';
  end if;
  if v_factura.id_metodo_pago=p_metodo_nuevo then return; end if;

  select * into v_movimiento from movimientos_financieros
  where id_factura=p_factura and estado='ACTIVO' for update;
  if not found then raise exception 'No se encontró el movimiento financiero de la factura'; end if;

  -- Bloqueo determinista para evitar cruces si dos correcciones ocurren a la vez.
  perform 1 from cuentas_financieras
  where id in (v_movimiento.id_cuenta,v_metodo.id_cuenta)
  order by id for update;

  select saldo_actual into v_cuenta_anterior from cuentas_financieras
  where id=v_movimiento.id_cuenta and id_tienda=v_factura.id_tienda and activa=true;
  if not found then raise exception 'La cuenta anterior no existe o está inactiva'; end if;
  select saldo_actual into v_cuenta_nueva from cuentas_financieras
  where id=v_metodo.id_cuenta and id_tienda=v_factura.id_tienda and activa=true;
  if not found then raise exception 'La cuenta nueva no existe o está inactiva'; end if;

  if v_movimiento.id_cuenta <> v_metodo.id_cuenta then
    update cuentas_financieras set saldo_actual=saldo_actual-v_factura.total
    where id=v_movimiento.id_cuenta;
    update cuentas_financieras set saldo_actual=saldo_actual+v_factura.total
    where id=v_metodo.id_cuenta;

    -- Si el ingreso pertenecía a una caja ya cerrada, recalcula su cierre.
    if v_movimiento.id_caja is not null then
      update cajas_sesiones
      set total_ingresos=greatest(0,total_ingresos-v_factura.total),
          saldo_esperado=saldo_esperado-v_factura.total,
          diferencia=case when saldo_contado is null then diferencia
                          else saldo_contado-(saldo_esperado-v_factura.total) end
      where id_caja=v_movimiento.id_caja and estado='CERRADA';
    end if;

    select id_caja into v_caja_nueva from cajas_sesiones
    where id_tienda=v_factura.id_tienda and id_cuenta=v_metodo.id_cuenta and estado='ABIERTA'
    order by fecha_apertura desc limit 1;

    update movimientos_financieros
    set id_cuenta=v_metodo.id_cuenta,
        id_caja=v_caja_nueva,
        saldo_anterior=v_cuenta_nueva,
        saldo_resultante=v_cuenta_nueva+v_factura.total,
        concepto='Ingreso por factura · método corregido',
        created_at=case when v_caja_nueva is not null then now() else created_at end
    where id_movimiento=v_movimiento.id_movimiento;
  end if;

  v_marca := '[Corrección '||to_char(now() at time zone 'America/Bogota','DD/MM/YYYY HH24:MI')||
    ': '||coalesce(v_factura.metodo_pago,'Sin método')||' → '||v_metodo.nombre||']';
  update facturas
  set id_metodo_pago=v_metodo.id_metodo,
      metodo_pago=v_metodo.nombre,
      destino_pago=coalesce(v_metodo.tipo_destino,'TIENDA'),
      notas=concat_ws(E'\n',nullif(notas,''),v_marca)
  where id_factura=p_factura;
end;
$$;

revoke all on function public.corregir_metodo_pago_factura(uuid,uuid) from public;
grant execute on function public.corregir_metodo_pago_factura(uuid,uuid) to authenticated;
