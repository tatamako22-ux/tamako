-- Segunda fase: ejecutar después de planes_comerciales_20261027.sql.
-- Aditiva: no elimina tiendas, clientes, reservas ni pagos.
begin;

-- La suscripción puede ser visible al superadmin aunque el JOIN de tiendas
-- quede vacío por RLS. Autorizar su lectura explícitamente recupera nombres.
drop policy if exists "Superadmin consulta tiendas" on public.tiendas;
create policy "Superadmin consulta tiendas" on public.tiendas
for select to authenticated using (public.es_tamaku_superadmin());

create table if not exists public.tamaku_sedes (
  id uuid primary key default gen_random_uuid(),
  tienda_principal uuid not null references public.tiendas(id),
  tienda_sede uuid not null unique references public.tiendas(id),
  created_at timestamptz not null default now(),
  check (tienda_principal<>tienda_sede)
);
create index if not exists tamaku_sedes_principal_idx on public.tamaku_sedes(tienda_principal);

create or replace function public.tienda_principal_tamaku(p_tienda uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select coalesce((select tienda_principal from tamaku_sedes where tienda_sede=p_tienda),p_tienda);
$$;
revoke all on function public.tienda_principal_tamaku(uuid) from public;

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
      case when s.estado='PRUEBA' then superior.codigo else p.codigo end codigo_efectivo,
      case when s.estado='PRUEBA' then superior.funcionalidades else p.funcionalidades end funciones,
      case when s.estado='PRUEBA' then superior.limite_profesionales else p.limite_profesionales end profesionales,
      case when s.estado='PRUEBA' then superior.limite_usuarios else p.limite_usuarios end usuarios,
      case when s.estado='PRUEBA' then s.fin_prueba else s.fin_periodo end fecha_fin
    from tamaku_suscripciones s join tamaku_planes p on p.id=s.plan_id
    cross join lateral (select * from tamaku_planes where activo and codigo<>'PRUEBA'
      order by precio_mensual desc,codigo limit 1) superior
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
revoke all on function public.obtener_estado_suscripcion(uuid) from public;
grant execute on function public.obtener_estado_suscripcion(uuid) to authenticated;

create or replace function public.plan_tiene_funcion(p_tienda uuid,p_funcion text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(bool_or(acceso and (funcionalidades->>p_funcion)::boolean),false)
  from obtener_estado_suscripcion(p_tienda);
$$;

-- El cupo de usuarios se comparte entre la principal y sus sedes.
create or replace function public.total_usuarios_plan_tamaku(p_tienda uuid,p_excluir uuid default null)
returns integer language sql volatile security definer set search_path=public as $$
  with grupo as (
    select tienda_principal_tamaku(p_tienda) id
    union select tienda_sede from tamaku_sedes where tienda_principal=tienda_principal_tamaku(p_tienda)
  ) select count(*)::integer from (
    select t.user_id from tiendas t join grupo g on g.id=t.id
    union select p.user_id from perfiles p join grupo g on g.id=p.tienda_id
      where p.activo=true and (p_excluir is null or p.id<>p_excluir)
  ) usuarios where user_id is not null;
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
    (select limite_usuarios from tamaku_planes where activo and codigo<>'PRUEBA' order by precio_mensual desc,codigo limit 1)
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

create or replace function public.contexto_sede_tamaku(p_tienda uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_tienda uuid;
begin
  select t.id into v_tienda from tiendas t where t.user_id=auth.uid()
    and (p_tienda is null or t.id=p_tienda)
    order by (exists(select 1 from tamaku_sedes where tienda_sede=t.id)),t.id limit 1;
  if v_tienda is null then return null; end if;
  return jsonb_build_object('id_tienda',v_tienda,'es_propietario',true,'rol','admin',
    'id_profesional',null,'permisos','{}'::jsonb,'tienda_principal',tienda_principal_tamaku(v_tienda));
end; $$;
revoke all on function public.contexto_sede_tamaku(uuid) from public;
grant execute on function public.contexto_sede_tamaku(uuid) to authenticated;

create or replace function public.validar_cambio_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limite integer;
begin
  if new.plan_id=old.plan_id and new.estado in ('SUSPENDIDA','CANCELADA') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_tienda::text,0));
  select case when new.estado='PRUEBA' then
    (select limite_usuarios from tamaku_planes where activo and codigo<>'PRUEBA' order by precio_mensual desc,codigo limit 1)
    else limite_usuarios end into v_limite from tamaku_planes where id=new.plan_id and activo;
  if v_limite is null then raise exception 'Plan sin límite de usuarios configurado'; end if;
  if total_usuarios_plan_tamaku(new.id_tienda)>v_limite then
    raise exception 'El plan admite % usuarios incluido el propietario. Desactiva los accesos sobrantes antes de cambiarlo.',v_limite;
  end if;
  return new;
end; $$;

create or replace function public.listar_sedes_tamaku(p_tienda uuid)
returns table(id uuid,nombre text,direccion text,telefono text,principal boolean)
language sql stable security definer set search_path=public as $$
  select t.id,t.nombre,t.direccion,t.telefono,t.id=tienda_principal_tamaku(p_tienda)
  from tiendas t where t.user_id=auth.uid()
    and (t.id=tienda_principal_tamaku(p_tienda) or exists(
      select 1 from tamaku_sedes s where s.tienda_principal=tienda_principal_tamaku(p_tienda) and s.tienda_sede=t.id))
    and plan_tiene_funcion(p_tienda,'multisede') order by 5 desc,2;
$$;
revoke all on function public.listar_sedes_tamaku(uuid) from public;
grant execute on function public.listar_sedes_tamaku(uuid) to authenticated;

create or replace function public.crear_sede_tamaku(p_tienda uuid,p_nombre text,p_direccion text,p_telefono text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_principal uuid; v_sede uuid; v_tienda tiendas%rowtype;
begin
  v_principal:=tienda_principal_tamaku(p_tienda);
  select * into v_tienda from tiendas where id=v_principal and user_id=auth.uid();
  if not found or not plan_tiene_funcion(v_principal,'multisede') then raise exception 'Se requiere ser propietario con plan Diamante vigente'; end if;
  if length(trim(p_nombre)) not between 2 and 100 then raise exception 'Escribe un nombre de sede de 2 a 100 caracteres'; end if;
  -- Tienda independiente para sus agendas, servicios, clientes y ventas.
  insert into tiendas(user_id,nombre,slug,propietario,email,telefono,direccion,cantidad_puestos)
    values(auth.uid(),trim(p_nombre),'sede-'||gen_random_uuid()::text,v_tienda.propietario,
      v_tienda.email,left(trim(p_telefono),30),left(trim(p_direccion),250),1) returning id into v_sede;
  insert into tamaku_sedes(tienda_principal,tienda_sede) values(v_principal,v_sede);
  return v_sede;
end; $$;
revoke all on function public.crear_sede_tamaku(uuid,text,text,text) from public;
grant execute on function public.crear_sede_tamaku(uuid,text,text,text) to authenticated;

alter table public.tamaku_sedes enable row level security;
revoke all on public.tamaku_sedes from anon,authenticated;
grant select on public.tamaku_sedes to authenticated;
drop policy if exists "Superadmin consulta relacion sedes" on public.tamaku_sedes;
create policy "Superadmin consulta relacion sedes" on public.tamaku_sedes for select to authenticated
using(es_tamaku_superadmin());

create or replace function public.validar_suscripcion_sede_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.id_tienda<>tienda_principal_tamaku(new.id_tienda) then
    raise exception 'Las sedes comparten la suscripción. Gestiona el plan y los pagos desde la tienda principal.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_suscripcion_sede on public.tamaku_suscripciones;
create trigger trg_suscripcion_sede before update of plan_id,plan_solicitado,estado on public.tamaku_suscripciones
for each row execute function public.validar_suscripcion_sede_tamaku();
drop trigger if exists trg_pago_sede on public.tamaku_pagos_suscripcion;
create trigger trg_pago_sede before insert on public.tamaku_pagos_suscripcion
for each row execute function public.validar_suscripcion_sede_tamaku();

create table if not exists public.tamaku_comercial (
  id uuid primary key default gen_random_uuid(),
  id_tienda uuid not null references public.tiendas(id),
  tipo text not null check(tipo in ('CAMPANA','OPORTUNIDAD','TAREA')),
  titulo text not null check(length(trim(titulo)) between 2 and 120),
  contacto text not null default '' check(length(contacto)<=120),
  telefono text not null default '' check(telefono='' or telefono ~ '^[0-9]{7,15}$'),
  consentimiento boolean not null default false,
  etapa text not null default 'PENDIENTE' check(etapa in ('PENDIENTE','EN_CURSO','COMPLETADA','NUEVA','CONTACTADA','PROPUESTA','GANADA','PERDIDA')),
  valor numeric(12,2) not null default 0 check(valor>=0),
  proxima_accion date,
  notas text not null default '' check(length(notas)<=4000),
  archivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tamaku_comercial_tienda_tipo_idx on public.tamaku_comercial(id_tienda,tipo,archivado,created_at desc);

create or replace function public.acceso_comercial_tamaku(p_tienda uuid,p_tipo text)
returns boolean language sql stable security definer set search_path=public as $$
  select p_tipo in ('CAMPANA','OPORTUNIDAD','TAREA') and
    plan_tiene_funcion(p_tienda,case when p_tipo='TAREA' then 'crm_avanzado' else 'marketing' end)
    and (exists(select 1 from tiendas where id=p_tienda and user_id=auth.uid())
      or exists(select 1 from perfiles where tienda_id=p_tienda and user_id=auth.uid()
        and activo=true and coalesce((permisos->>'clientes_gestionar')::boolean,false)));
$$;
revoke all on function public.acceso_comercial_tamaku(uuid,text) from public;
grant execute on function public.acceso_comercial_tamaku(uuid,text) to authenticated;
alter table public.tamaku_comercial enable row level security;
drop policy if exists "Plan y equipo comercial" on public.tamaku_comercial;
create policy "Plan y equipo comercial" on public.tamaku_comercial for all to authenticated
  using(acceso_comercial_tamaku(id_tienda,tipo)) with check(acceso_comercial_tamaku(id_tienda,tipo));
grant select,insert,update on public.tamaku_comercial to authenticated;
revoke delete on public.tamaku_comercial from authenticated;

create or replace function public.validar_registro_comercial_tamaku()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and (new.id_tienda<>old.id_tienda or new.tipo<>old.tipo) then
    raise exception 'No se puede trasladar un registro entre tiendas o módulos';
  end if;
  if (new.tipo='OPORTUNIDAD' and new.etapa not in ('NUEVA','CONTACTADA','PROPUESTA','GANADA','PERDIDA'))
    or (new.tipo<>'OPORTUNIDAD' and new.etapa not in ('PENDIENTE','EN_CURSO','COMPLETADA')) then
    raise exception 'Estado inválido para este registro';
  end if;
  new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_validar_comercial on public.tamaku_comercial;
create trigger trg_validar_comercial before insert or update on public.tamaku_comercial
for each row execute function public.validar_registro_comercial_tamaku();

-- Las promociones se reservan a Zafiro y Diamante; los avisos de servicio siguen en todos.
create or replace function public.validar_promocion_plan_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tablon_tipo='promocion' and new.tablon_activo=true
    and not plan_tiene_funcion(new.id,'marketing') then
    raise exception 'Publicar promociones requiere Zafiro o Diamante vigente';
  end if;
  return new;
end; $$;
drop trigger if exists trg_promocion_plan on public.tiendas;
create trigger trg_promocion_plan before update of tablon_tipo,tablon_activo,tablon_titulo,tablon_mensaje
on public.tiendas for each row execute function public.validar_promocion_plan_tamaku();

notify pgrst,'reload schema';
commit;
