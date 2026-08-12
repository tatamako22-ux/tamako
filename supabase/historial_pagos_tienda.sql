-- TAMAKU: historial de pagos visible para cada tienda.
-- Ejecutar una vez en Supabase > SQL Editor.

begin;

create or replace function public.obtener_pagos_tienda_tamaku(p_tienda uuid)
returns table(
  id uuid,
  monto numeric,
  fecha_pago timestamptz,
  periodo_desde timestamptz,
  periodo_hasta timestamptz,
  referencia text,
  estado text,
  plan_codigo text,
  plan_nombre text
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_tamaku_superadmin()
     and not exists (
       select 1 from public.tiendas tienda
       where tienda.id=p_tienda
         and tienda.user_id=auth.uid()
     )
     and not exists (
       select 1 from public.perfiles perfil
       where perfil.user_id=auth.uid()
         and perfil.tienda_id=p_tienda
         and perfil.activo=true
     ) then
    raise exception 'Sin acceso al historial de pagos de esta tienda';
  end if;

  return query
  select pago.id, pago.monto, pago.fecha_pago, pago.periodo_desde,
         pago.periodo_hasta, pago.referencia, pago.estado,
         plan.codigo, plan.nombre
  from public.tamaku_pagos_suscripcion pago
  join public.tamaku_planes plan on plan.id=pago.plan_id
  where pago.id_tienda=p_tienda and pago.estado='CONFIRMADO'
  order by pago.fecha_pago desc, pago.created_at desc;
end;
$$;

-- Las políticas anteriores solo reconocían accesos guardados en perfiles.
-- El propietario original de la tienda está vinculado mediante tiendas.user_id.
drop policy if exists "superadmin ve suscripciones" on public.tamaku_suscripciones;
create policy "superadmin ve suscripciones" on public.tamaku_suscripciones
for select to authenticated using (
  public.es_tamaku_superadmin()
  or exists (
    select 1 from public.tiendas tienda
    where tienda.id=tamaku_suscripciones.id_tienda
      and tienda.user_id=auth.uid()
  )
  or exists (
    select 1 from public.perfiles perfil
    where perfil.user_id=auth.uid()
      and perfil.tienda_id=tamaku_suscripciones.id_tienda
      and perfil.activo=true
  )
);

drop policy if exists "superadmin ve pagos" on public.tamaku_pagos_suscripcion;
create policy "superadmin ve pagos" on public.tamaku_pagos_suscripcion
for select to authenticated using (
  public.es_tamaku_superadmin()
  or exists (
    select 1 from public.tiendas tienda
    where tienda.id=tamaku_pagos_suscripcion.id_tienda
      and tienda.user_id=auth.uid()
  )
  or exists (
    select 1 from public.perfiles perfil
    where perfil.user_id=auth.uid()
      and perfil.tienda_id=tamaku_pagos_suscripcion.id_tienda
      and perfil.activo=true
  )
);

revoke all on function public.obtener_pagos_tienda_tamaku(uuid) from public;
grant execute on function public.obtener_pagos_tienda_tamaku(uuid) to authenticated;

commit;
