-- TAMAKU: Superadmin, pruebas de 7 días y pagos manuales.
-- Ejecutar una vez en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.tamaku_superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'Administrador TAMAKU',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tamaku_planes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  precio_mensual numeric(12,2) not null default 0,
  dias_vigencia integer not null default 30,
  activo boolean not null default true
);

insert into public.tamaku_planes(codigo,nombre,precio_mensual,dias_vigencia) values
 ('PRUEBA','Prueba 7 días',0,7),('BASICO','Plan Básico',29900,30),
 ('PRO','Plan Pro',59900,30),('PREMIUM','Plan Premium',99900,30)
on conflict(codigo) do update set nombre=excluded.nombre,precio_mensual=excluded.precio_mensual,dias_vigencia=excluded.dias_vigencia;

create table if not exists public.tamaku_suscripciones (
  id uuid primary key default gen_random_uuid(),
  id_tienda uuid not null unique references public.tiendas(id) on delete cascade,
  plan_id uuid not null references public.tamaku_planes(id),
  plan_solicitado text not null default 'PRUEBA',
  estado text not null default 'PRUEBA' check(estado in('PRUEBA','ACTIVA','SUSPENDIDA','CANCELADA')),
  inicio_prueba timestamptz not null default now(),
  fin_prueba timestamptz not null default (now()+interval '7 days'),
  inicio_periodo timestamptz,
  fin_periodo timestamptz,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tamaku_pagos_suscripcion (
  id uuid primary key default gen_random_uuid(),
  id_tienda uuid not null references public.tiendas(id) on delete cascade,
  plan_id uuid not null references public.tamaku_planes(id),
  monto numeric(12,2) not null check(monto>0),
  metodo text not null default 'TRANSFERENCIA',
  referencia text,
  estado text not null default 'CONFIRMADO' check(estado in('PENDIENTE','CONFIRMADO','RECHAZADO')),
  registrado_por uuid references auth.users(id),
  notas text,
  fecha_pago timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.tamaku_notificaciones_admin (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  mensaje text not null,
  id_tienda uuid references public.tiendas(id) on delete cascade,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tamaku_suscripciones_estado_idx on public.tamaku_suscripciones(estado,fin_prueba,fin_periodo);
create index if not exists tamaku_pagos_tienda_idx on public.tamaku_pagos_suscripcion(id_tienda,fecha_pago desc);
create index if not exists tamaku_notificaciones_fecha_idx on public.tamaku_notificaciones_admin(leida,created_at desc);

create or replace function public.es_tamaku_superadmin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from tamaku_superadmins where user_id=auth.uid() and activo) $$;

create or replace function public.crear_prueba_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan uuid;
begin
  select id into v_plan from tamaku_planes where codigo='PRUEBA';
  insert into tamaku_suscripciones(id_tienda,plan_id) values(new.id,v_plan) on conflict(id_tienda) do nothing;
  insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda)
  values('NUEVA_PRUEBA','Nueva tienda en prueba',new.nombre||' inició sus 7 días gratuitos.',new.id);
  return new;
end; $$;

drop trigger if exists trg_tienda_prueba_tamaku on public.tiendas;
create trigger trg_tienda_prueba_tamaku after insert on public.tiendas for each row execute function public.crear_prueba_tamaku();

-- Crea pruebas para tiendas ya existentes sin alterar su información.
insert into public.tamaku_suscripciones(id_tienda,plan_id,inicio_prueba,fin_prueba)
select t.id,p.id,now(),now()+interval '7 days' from public.tiendas t cross join public.tamaku_planes p
where p.codigo='PRUEBA' and not exists(select 1 from public.tamaku_suscripciones s where s.id_tienda=t.id);

create or replace function public.seleccionar_plan_tamaku(p_tienda uuid,p_plan text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from perfiles where user_id=auth.uid() and tienda_id=p_tienda and activo=true) then raise exception 'Sin acceso a la tienda'; end if;
  update tamaku_suscripciones set plan_solicitado=upper(coalesce(p_plan,'PRUEBA')),updated_at=now() where id_tienda=p_tienda;
end; $$;

create or replace function public.obtener_estado_suscripcion(p_id_tienda uuid)
returns table(estado text,plan text,acceso boolean,vence timestamptz,dias_restantes integer)
language sql stable security definer set search_path=public as $$
 select s.estado,p.codigo,
   case when s.estado='PRUEBA' then s.fin_prueba>now() when s.estado='ACTIVA' then s.fin_periodo>now() else false end,
   case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end,
   greatest(0,ceil(extract(epoch from ((case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end)-now()))/86400.0)::int)
 from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id where s.id_tienda=p_id_tienda;
$$;

create or replace function public.confirmar_pago_manual_tamaku(p_tienda uuid,p_plan text,p_monto numeric,p_referencia text,p_notas text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_plan tamaku_planes%rowtype; v_pago uuid; v_inicio timestamptz;
begin
 if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
 select * into v_plan from tamaku_planes where codigo=upper(p_plan) and activo and codigo<>'PRUEBA';
 if not found then raise exception 'Plan inválido'; end if;
 v_inicio:=greatest(now(),coalesce((select fin_periodo from tamaku_suscripciones where id_tienda=p_tienda and estado='ACTIVA'),now()));
 insert into tamaku_pagos_suscripcion(id_tienda,plan_id,monto,referencia,registrado_por,notas)
 values(p_tienda,v_plan.id,p_monto,nullif(trim(p_referencia),''),auth.uid(),nullif(trim(p_notas),'')) returning id into v_pago;
 update tamaku_suscripciones set plan_id=v_plan.id,plan_solicitado=v_plan.codigo,estado='ACTIVA',inicio_periodo=now(),fin_periodo=v_inicio+(v_plan.dias_vigencia||' days')::interval,updated_at=now() where id_tienda=p_tienda;
 insert into tamaku_notificaciones_admin(tipo,titulo,mensaje,id_tienda) values('PAGO_CONFIRMADO','Pago confirmado','Se activó '||v_plan.nombre||' por '||p_monto,p_tienda);
 return v_pago;
end; $$;

create or replace function public.cambiar_estado_suscripcion_tamaku(p_tienda uuid,p_estado text,p_observacion text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
 if upper(p_estado) not in('PRUEBA','ACTIVA','SUSPENDIDA','CANCELADA') then raise exception 'Estado inválido'; end if;
 update tamaku_suscripciones set estado=upper(p_estado),observaciones=nullif(trim(p_observacion),''),updated_at=now() where id_tienda=p_tienda;
end; $$;

create or replace function public.extender_prueba_tamaku(p_tienda uuid,p_dias integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not es_tamaku_superadmin() then raise exception 'Acceso Superadmin requerido'; end if;
 update tamaku_suscripciones set estado='PRUEBA',fin_prueba=greatest(now(),fin_prueba)+(greatest(1,p_dias)||' days')::interval,updated_at=now() where id_tienda=p_tienda;
end; $$;

alter table public.tamaku_superadmins enable row level security;
alter table public.tamaku_planes enable row level security;
alter table public.tamaku_suscripciones enable row level security;
alter table public.tamaku_pagos_suscripcion enable row level security;
alter table public.tamaku_notificaciones_admin enable row level security;

create policy "superadmin propio" on public.tamaku_superadmins for select to authenticated using(user_id=auth.uid() and activo);
create policy "planes autenticados" on public.tamaku_planes for select to authenticated using(activo or es_tamaku_superadmin());
create policy "superadmin ve suscripciones" on public.tamaku_suscripciones for select to authenticated using(es_tamaku_superadmin() or exists(select 1 from perfiles where user_id=auth.uid() and tienda_id=id_tienda and activo=true));
create policy "superadmin ve pagos" on public.tamaku_pagos_suscripcion for select to authenticated using(es_tamaku_superadmin() or exists(select 1 from perfiles where user_id=auth.uid() and tienda_id=id_tienda and activo=true));
create policy "superadmin notificaciones" on public.tamaku_notificaciones_admin for all to authenticated using(es_tamaku_superadmin()) with check(es_tamaku_superadmin());

revoke all on function public.confirmar_pago_manual_tamaku(uuid,text,numeric,text,text) from public;
revoke all on function public.cambiar_estado_suscripcion_tamaku(uuid,text,text) from public;
revoke all on function public.extender_prueba_tamaku(uuid,integer) from public;
grant execute on function public.seleccionar_plan_tamaku(uuid,text) to authenticated;
grant execute on function public.obtener_estado_suscripcion(uuid) to authenticated;
grant execute on function public.confirmar_pago_manual_tamaku(uuid,text,numeric,text,text) to authenticated;
grant execute on function public.cambiar_estado_suscripcion_tamaku(uuid,text,text) to authenticated;
grant execute on function public.extender_prueba_tamaku(uuid,integer) to authenticated;

-- PASO FINAL: crea primero el usuario en Authentication > Users y asigna aquí su correo:
-- insert into public.tamaku_superadmins(user_id,nombre)
-- select id,'Superadmin TAMAKU' from auth.users where lower(email)=lower('TU_CORREO_ADMINISTRADOR')
-- on conflict(user_id) do update set activo=true;
