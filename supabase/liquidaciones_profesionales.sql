-- TAMAKU: contratación, ganancias y pagos de profesionales.
-- Ejecutar una vez en Supabase > SQL Editor antes de publicar la interfaz.

begin;

alter table public.profesionales
  add column if not exists modalidad_pago text not null default 'PORCENTAJE',
  add column if not exists porcentaje_comision numeric(5,2) not null default 0,
  add column if not exists mensualidad numeric(12,2) not null default 0,
  add column if not exists contrato_desde date not null default current_date;

alter table public.profesionales drop constraint if exists profesionales_modalidad_pago_check;
alter table public.profesionales add constraint profesionales_modalidad_pago_check
  check(modalidad_pago in ('PORCENTAJE','MENSUALIDAD'));
alter table public.profesionales drop constraint if exists profesionales_porcentaje_comision_check;
alter table public.profesionales add constraint profesionales_porcentaje_comision_check
  check(porcentaje_comision between 0 and 100);
alter table public.profesionales drop constraint if exists profesionales_mensualidad_check;
alter table public.profesionales add constraint profesionales_mensualidad_check check(mensualidad >= 0);

alter table public.factura_detalles
  add column if not exists modalidad_pago_snapshot text,
  add column if not exists porcentaje_snapshot numeric(5,2),
  add column if not exists valor_profesional numeric(12,2),
  add column if not exists valor_tienda numeric(12,2);

create or replace function public.congelar_distribucion_factura()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_modalidad text;
  v_porcentaje numeric(5,2);
  v_total numeric(12,2);
begin
  select p.modalidad_pago,p.porcentaje_comision
    into v_modalidad,v_porcentaje
  from facturas f join profesionales p on p.id_barbero=f.id_barbero
  where f.id_factura=new.id_factura;

  v_modalidad:=coalesce(v_modalidad,'PORCENTAJE');
  v_porcentaje:=coalesce(v_porcentaje,0);
  v_total:=coalesce(new.total_linea,new.precio_unitario*new.cantidad-coalesce(new.descuento,0),0);
  new.modalidad_pago_snapshot:=v_modalidad;
  new.porcentaje_snapshot:=case when v_modalidad='PORCENTAJE' then v_porcentaje else 0 end;
  new.valor_profesional:=case when v_modalidad='PORCENTAJE' then round(v_total*v_porcentaje/100,2) else 0 end;
  new.valor_tienda:=v_total-new.valor_profesional;
  return new;
end; $$;

drop trigger if exists trg_congelar_distribucion_factura on public.factura_detalles;
create trigger trg_congelar_distribucion_factura before insert on public.factura_detalles
for each row execute function public.congelar_distribucion_factura();

-- Completa facturas históricas sin alterar las que ya tengan una distribución congelada.
update public.factura_detalles d set
  modalidad_pago_snapshot=coalesce(d.modalidad_pago_snapshot,p.modalidad_pago),
  porcentaje_snapshot=case when p.modalidad_pago='PORCENTAJE' then p.porcentaje_comision else 0 end,
  valor_profesional=case when p.modalidad_pago='PORCENTAJE'
    then round(coalesce(d.total_linea,d.precio_unitario*d.cantidad-coalesce(d.descuento,0),0)*p.porcentaje_comision/100,2)
    else 0 end,
  valor_tienda=case when p.modalidad_pago='PORCENTAJE'
    then coalesce(d.total_linea,d.precio_unitario*d.cantidad-coalesce(d.descuento,0),0)-round(coalesce(d.total_linea,d.precio_unitario*d.cantidad-coalesce(d.descuento,0),0)*p.porcentaje_comision/100,2)
    else coalesce(d.total_linea,d.precio_unitario*d.cantidad-coalesce(d.descuento,0),0) end
from public.facturas f join public.profesionales p on p.id_barbero=f.id_barbero
where d.id_factura=f.id_factura and d.valor_profesional is null;

create table if not exists public.pagos_profesionales (
  id uuid primary key default gen_random_uuid(),
  id_tienda uuid not null references public.tiendas(id) on delete cascade,
  id_profesional uuid not null references public.profesionales(id_barbero) on delete restrict,
  periodo_desde date not null,
  periodo_hasta date not null,
  monto numeric(12,2) not null check(monto>0),
  id_cuenta uuid not null references public.cuentas_financieras(id) on delete restrict,
  id_movimiento uuid references public.movimientos_financieros(id_movimiento) on delete restrict,
  fecha_pago timestamptz not null default now(),
  referencia text,
  notas text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check(periodo_hasta>=periodo_desde)
);

create index if not exists pagos_profesionales_tienda_periodo_idx
  on public.pagos_profesionales(id_tienda,id_profesional,periodo_desde,periodo_hasta);

alter table public.movimientos_financieros
  add column if not exists id_pago_profesional uuid references public.pagos_profesionales(id) on delete restrict;

create or replace function public.es_propietario_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from tiendas where id=p_tienda and user_id=auth.uid());
$$;

create or replace function public.es_profesional_vinculado(p_profesional uuid,p_tienda uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from perfiles where user_id=auth.uid() and tienda_id=p_tienda
    and id_profesional=p_profesional and activo=true);
$$;

alter table public.pagos_profesionales enable row level security;
drop policy if exists "Propietario consulta pagos profesionales" on public.pagos_profesionales;
drop policy if exists "Profesional consulta pagos propios" on public.pagos_profesionales;
create policy "Propietario consulta pagos profesionales" on public.pagos_profesionales
  for select to authenticated using(public.es_propietario_tienda(id_tienda));
create policy "Profesional consulta pagos propios" on public.pagos_profesionales
  for select to authenticated using(public.es_profesional_vinculado(id_profesional,id_tienda));

create or replace function public.registrar_pago_profesional(
  p_tienda uuid,p_profesional uuid,p_cuenta uuid,p_monto numeric,
  p_desde date,p_hasta date,p_referencia text default null,p_notas text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_pago uuid;
  v_movimiento uuid;
  v_saldo numeric(12,2);
  v_caja uuid;
begin
  if not es_propietario_tienda(p_tienda) then raise exception 'Solo el propietario puede registrar pagos'; end if;
  if p_monto<=0 or p_hasta<p_desde then raise exception 'Los datos del pago no son válidos'; end if;
  perform 1 from profesionales where id_barbero=p_profesional and id_tienda=p_tienda;
  if not found then raise exception 'El profesional no pertenece a la tienda'; end if;
  select saldo_actual into v_saldo from cuentas_financieras
    where id=p_cuenta and id_tienda=p_tienda and activa=true for update;
  if not found then raise exception 'La cuenta no existe o está inactiva'; end if;
  if v_saldo<p_monto then raise exception 'La cuenta no tiene saldo suficiente'; end if;
  insert into pagos_profesionales(id_tienda,id_profesional,periodo_desde,periodo_hasta,monto,id_cuenta,referencia,notas)
    values(p_tienda,p_profesional,p_desde,p_hasta,p_monto,p_cuenta,nullif(trim(p_referencia),''),nullif(trim(p_notas),''))
    returning id into v_pago;
  select id_caja into v_caja from cajas_sesiones where id_tienda=p_tienda and id_cuenta=p_cuenta
    and estado='ABIERTA' order by fecha_apertura desc limit 1;
  update cuentas_financieras set saldo_actual=saldo_actual-p_monto where id=p_cuenta;
  insert into movimientos_financieros(id_tienda,id_cuenta,id_caja,tipo,concepto,monto,saldo_anterior,saldo_resultante,created_by,id_pago_profesional)
    values(p_tienda,p_cuenta,v_caja,'EGRESO','Pago a profesional',p_monto,v_saldo,v_saldo-p_monto,auth.uid(),v_pago)
    returning id_movimiento into v_movimiento;
  update pagos_profesionales set id_movimiento=v_movimiento where id=v_pago;
  return v_pago;
end; $$;

revoke all on function public.es_propietario_tienda(uuid) from public;
revoke all on function public.es_profesional_vinculado(uuid,uuid) from public;
revoke all on function public.registrar_pago_profesional(uuid,uuid,uuid,numeric,date,date,text,text) from public;
grant execute on function public.es_propietario_tienda(uuid) to authenticated;
grant execute on function public.es_profesional_vinculado(uuid,uuid) to authenticated;
grant execute on function public.registrar_pago_profesional(uuid,uuid,uuid,numeric,date,date,text,text) to authenticated;

commit;
