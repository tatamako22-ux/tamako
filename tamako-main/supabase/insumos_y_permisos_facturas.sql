-- TAMAKU: Insumos/cuentas por pagar + edición restringida de facturas.
-- Reutiliza cuentas_financieras y movimientos_financieros.
-- Ejecutar una vez en Supabase > SQL Editor.

begin;

create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  id_tienda uuid not null references public.tiendas(id) on delete cascade,
  nombre text not null,
  proveedor text,
  cantidad numeric(12,2) not null default 1 check(cantidad>0),
  unidad text not null default 'UNIDAD',
  costo_total numeric(12,2) not null check(costo_total>0),
  estado text not null default 'PENDIENTE' check(estado in('PENDIENTE','PAGADO','CANCELADO')),
  fecha_registro timestamptz not null default now(),
  fecha_pago timestamptz,
  id_cuenta uuid references public.cuentas_financieras(id) on delete restrict,
  id_movimiento uuid references public.movimientos_financieros(id_movimiento) on delete restrict,
  created_by uuid default auth.uid() references auth.users(id),
  notas text
);

create index if not exists insumos_tienda_estado_idx on public.insumos(id_tienda,estado,fecha_registro desc);

create or replace function public.puede_gestionar_insumos(p_id_tienda uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from tiendas where id=p_id_tienda and user_id=auth.uid())
  or exists(select 1 from perfiles where tienda_id=p_id_tienda and user_id=auth.uid() and activo=true
    and coalesce((permisos->>'cuentas_gestionar')::boolean,false));
$$;

create or replace function public.puede_editar_factura(
  p_id_tienda uuid,p_id_profesional uuid
)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from tiendas where id=p_id_tienda and user_id=auth.uid())
  or exists(
    select 1 from perfiles p
    where p.tienda_id=p_id_tienda and p.user_id=auth.uid() and p.activo=true
      and coalesce((p.permisos->>'facturas_crear')::boolean,false)
      and (p.id_profesional is null or p.id_profesional=p_id_profesional)
  );
$$;

alter table public.insumos enable row level security;
drop policy if exists "Equipo consulta insumos" on public.insumos;
drop policy if exists "Equipo registra insumos" on public.insumos;
drop policy if exists "Equipo modifica insumos" on public.insumos;
drop policy if exists "Equipo elimina insumos pendientes" on public.insumos;
create policy "Equipo consulta insumos" on public.insumos for select to authenticated
  using(tiene_permiso_tienda(id_tienda,'facturacion_ver') or puede_gestionar_insumos(id_tienda));
create policy "Equipo registra insumos" on public.insumos for insert to authenticated
  with check(puede_gestionar_insumos(id_tienda));
create policy "Equipo elimina insumos pendientes" on public.insumos for delete to authenticated
  using(estado='PENDIENTE' and puede_gestionar_insumos(id_tienda));

-- Sustituye la política amplia: un profesional solo modifica sus facturas.
drop policy if exists "Equipo actualiza facturas autorizado" on public.facturas;
create policy "Equipo actualiza facturas autorizado" on public.facturas for update to authenticated
  using(puede_editar_factura(id_tienda,id_barbero))
  with check(puede_editar_factura(id_tienda,id_barbero));

create or replace function public.pagar_insumo(p_insumo uuid,p_cuenta uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_insumo insumos%rowtype;
  v_saldo numeric(12,2);
  v_nuevo_saldo numeric(12,2);
  v_caja uuid;
  v_movimiento uuid;
begin
  select * into v_insumo from insumos where id=p_insumo for update;
  if not found then raise exception 'El insumo no existe'; end if;
  if not puede_gestionar_insumos(v_insumo.id_tienda) then raise exception 'No tienes permiso para pagar insumos'; end if;
  if v_insumo.estado<>'PENDIENTE' then raise exception 'El insumo ya fue pagado o cancelado'; end if;

  select saldo_actual into v_saldo from cuentas_financieras
  where id=p_cuenta and id_tienda=v_insumo.id_tienda and activa=true for update;
  if not found then raise exception 'La cuenta no existe o está inactiva'; end if;
  if v_saldo<v_insumo.costo_total then raise exception 'La cuenta no tiene saldo suficiente'; end if;
  v_nuevo_saldo:=v_saldo-v_insumo.costo_total;

  select id_caja into v_caja from cajas_sesiones
  where id_tienda=v_insumo.id_tienda and id_cuenta=p_cuenta and estado='ABIERTA'
  order by fecha_apertura desc limit 1;

  update cuentas_financieras set saldo_actual=v_nuevo_saldo where id=p_cuenta;
  insert into movimientos_financieros(id_tienda,id_cuenta,id_caja,tipo,concepto,monto,saldo_anterior,saldo_resultante,created_by)
  values(v_insumo.id_tienda,p_cuenta,v_caja,'EGRESO','Pago de insumo: '||v_insumo.nombre,
    v_insumo.costo_total,v_saldo,v_nuevo_saldo,auth.uid()) returning id_movimiento into v_movimiento;
  update insumos set estado='PAGADO',fecha_pago=now(),id_cuenta=p_cuenta,id_movimiento=v_movimiento
  where id=v_insumo.id;
  return v_movimiento;
end; $$;

-- Refuerza la corrección existente con el alcance del profesional.
create or replace function public.corregir_metodo_pago_factura(p_factura uuid,p_metodo_nuevo uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_factura facturas%rowtype; v_movimiento movimientos_financieros%rowtype; v_metodo metodos_pago%rowtype;
  v_cuenta_anterior numeric(12,2); v_cuenta_nueva numeric(12,2); v_caja_nueva uuid; v_marca text;
begin
  select * into v_factura from facturas where id_factura=p_factura for update;
  if not found then raise exception 'La factura no existe'; end if;
  if not puede_editar_factura(v_factura.id_tienda,v_factura.id_barbero) then raise exception 'Solo puedes corregir tus propias facturas'; end if;
  if upper(coalesce(v_factura.estado,''))<>'PAGADA' then raise exception 'Solo se puede corregir una factura pagada'; end if;
  select * into v_metodo from metodos_pago where id_metodo=p_metodo_nuevo and id_tienda=v_factura.id_tienda and activo=true;
  if not found or v_metodo.id_cuenta is null then raise exception 'El método nuevo no es válido'; end if;
  if v_factura.id_metodo_pago=p_metodo_nuevo then return; end if;
  select * into v_movimiento from movimientos_financieros where id_factura=p_factura and estado='ACTIVO' for update;
  if not found then raise exception 'No se encontró el movimiento financiero de la factura'; end if;
  perform 1 from cuentas_financieras where id in(v_movimiento.id_cuenta,v_metodo.id_cuenta) order by id for update;
  select saldo_actual into v_cuenta_anterior from cuentas_financieras where id=v_movimiento.id_cuenta and id_tienda=v_factura.id_tienda and activa=true;
  if not found then raise exception 'La cuenta anterior no está disponible'; end if;
  select saldo_actual into v_cuenta_nueva from cuentas_financieras where id=v_metodo.id_cuenta and id_tienda=v_factura.id_tienda and activa=true;
  if not found then raise exception 'La cuenta nueva no está disponible'; end if;
  if v_movimiento.id_cuenta<>v_metodo.id_cuenta then
    update cuentas_financieras set saldo_actual=saldo_actual-v_factura.total where id=v_movimiento.id_cuenta;
    update cuentas_financieras set saldo_actual=saldo_actual+v_factura.total where id=v_metodo.id_cuenta;
    if v_movimiento.id_caja is not null then update cajas_sesiones set total_ingresos=greatest(0,total_ingresos-v_factura.total),saldo_esperado=saldo_esperado-v_factura.total,diferencia=case when saldo_contado is null then diferencia else saldo_contado-(saldo_esperado-v_factura.total) end where id_caja=v_movimiento.id_caja and estado='CERRADA'; end if;
    select id_caja into v_caja_nueva from cajas_sesiones where id_tienda=v_factura.id_tienda and id_cuenta=v_metodo.id_cuenta and estado='ABIERTA' order by fecha_apertura desc limit 1;
    update movimientos_financieros set id_cuenta=v_metodo.id_cuenta,id_caja=v_caja_nueva,saldo_anterior=v_cuenta_nueva,saldo_resultante=v_cuenta_nueva+v_factura.total,concepto='Ingreso por factura · método corregido',created_at=case when v_caja_nueva is not null then now() else created_at end where id_movimiento=v_movimiento.id_movimiento;
  end if;
  v_marca:='[Corrección '||to_char(now() at time zone 'America/Bogota','DD/MM/YYYY HH24:MI')||': '||coalesce(v_factura.metodo_pago,'Sin método')||' → '||v_metodo.nombre||']';
  update facturas set id_metodo_pago=v_metodo.id_metodo,metodo_pago=v_metodo.nombre,destino_pago=coalesce(v_metodo.tipo_destino,'TIENDA'),notas=concat_ws(E'\n',nullif(notas,''),v_marca) where id_factura=p_factura;
end; $$;

revoke all on function public.pagar_insumo(uuid,uuid) from public;
revoke all on function public.puede_gestionar_insumos(uuid) from public;
revoke all on function public.puede_editar_factura(uuid,uuid) from public;
grant execute on function public.pagar_insumo(uuid,uuid) to authenticated;
grant execute on function public.puede_gestionar_insumos(uuid) to authenticated;
grant execute on function public.puede_editar_factura(uuid,uuid) to authenticated;

commit;
