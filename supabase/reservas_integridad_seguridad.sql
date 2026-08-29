-- Seguridad e integridad del modulo de reservas.
-- Requiere corregir previamente cualquier cita activa superpuesta o sin hora_fin.

create extension if not exists btree_gist;

alter table public.perfiles_clientes enable row level security;
alter table public.citas enable row level security;

drop policy if exists "Admins pueden ver todos los clientes" on public.perfiles_clientes;
drop policy if exists "Inserción pública de perfiles" on public.perfiles_clientes;
drop policy if exists "Permitir inserciones públicas" on public.perfiles_clientes;
drop policy if exists "Permitir inserción pública de perfiles" on public.perfiles_clientes;
drop policy if exists "Permitir actualización de perfil propio" on public.perfiles_clientes;
drop policy if exists "Los clientes pueden insertar su propio perfil" on public.perfiles_clientes;
drop policy if exists "Usuarios crean su propio perfil" on public.perfiles_clientes;
drop policy if exists "Los clientes pueden ver su propio perfil" on public.perfiles_clientes;
drop policy if exists "Usuarios ven su propio perfil" on public.perfiles_clientes;
drop policy if exists "Ver perfil propio" on public.perfiles_clientes;

drop policy if exists "Usuarios manejan su propio perfil" on public.perfiles_clientes;
create policy "Usuarios manejan su propio perfil"
on public.perfiles_clientes
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Reserva publica crea cita valida" on public.citas;
drop policy if exists "Cliente crea su propia cita" on public.citas;
create policy "Cliente crea su propia cita"
on public.citas
for insert
to authenticated
with check (
  user_id = auth.uid()
  and upper(estado) = 'PENDIENTE'
  and nullif(trim(servicio), '') is not null
);

drop policy if exists "Equipo crea citas autorizadas" on public.citas;
create policy "Equipo crea citas autorizadas"
on public.citas
for insert
to authenticated
with check (puede_acceder_cita(id_tienda, id_barbero, 'agenda_gestionar'));

drop policy if exists "Cliente actualiza sus citas" on public.citas;
drop policy if exists "Cliente cancela sus propias citas" on public.citas;
create policy "Cliente cancela sus propias citas"
on public.citas
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and upper(estado) = 'CANCELADA');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.citas'::regclass
      and conname = 'citas_activas_horario_valido'
  ) then
    alter table public.citas
      add constraint citas_activas_horario_valido
      check (
        upper(estado) not in ('PENDIENTE', 'CONFIRMADA')
        or (
          fecha is not null
          and hora_inicio is not null
          and hora_fin is not null
          and hora_fin > hora_inicio
        )
      );
  end if;
end $$;

-- Auditoria del origen de cada cancelacion para el dashboard.
alter table public.citas
  add column if not exists cancelada_en timestamptz,
  add column if not exists cancelada_por_tipo text,
  add column if not exists cancelada_por_user_id uuid,
  add column if not exists cancelada_por_profesional_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.citas'::regclass
      and conname = 'citas_cancelada_por_tipo_valido'
  ) then
    alter table public.citas
      add constraint citas_cancelada_por_tipo_valido
      check (
        cancelada_por_tipo is null
        or cancelada_por_tipo in (
          'CLIENTE', 'PROFESIONAL', 'EQUIPO', 'PROPIETARIO', 'SISTEMA', 'HISTORICO'
        )
      );
  end if;
end $$;

create or replace function public.registrar_origen_cancelacion_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id_profesional uuid;
begin
  if upper(coalesce(new.estado, '')) = 'CANCELADA'
     and upper(coalesce(old.estado, '')) <> 'CANCELADA' then
    new.cancelada_en := now();
    new.cancelada_por_user_id := v_actor;
    new.cancelada_por_profesional_id := null;

    if v_actor is null then
      new.cancelada_por_tipo := 'SISTEMA';
    elsif old.user_id = v_actor then
      new.cancelada_por_tipo := 'CLIENTE';
    elsif exists (
      select 1 from public.tiendas t
      where t.id = old.id_tienda and t.user_id = v_actor
    ) then
      new.cancelada_por_tipo := 'PROPIETARIO';
    else
      select p.id_profesional into v_id_profesional
      from public.perfiles p
      where p.user_id = v_actor
        and p.tienda_id = old.id_tienda
        and p.activo = true
      limit 1;

      if v_id_profesional is not null
         and v_id_profesional = old.id_barbero then
        new.cancelada_por_tipo := 'PROFESIONAL';
        new.cancelada_por_profesional_id := v_id_profesional;
      else
        new.cancelada_por_tipo := 'EQUIPO';
        new.cancelada_por_profesional_id := v_id_profesional;
      end if;
    end if;
  elsif upper(coalesce(old.estado, '')) = 'CANCELADA'
        and upper(coalesce(new.estado, '')) <> 'CANCELADA' then
    new.cancelada_en := null;
    new.cancelada_por_tipo := null;
    new.cancelada_por_user_id := null;
    new.cancelada_por_profesional_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists ab_registrar_origen_cancelacion_trigger on public.citas;
create trigger ab_registrar_origen_cancelacion_trigger
before update of estado on public.citas for each row
execute function public.registrar_origen_cancelacion_cita();

revoke execute on function public.registrar_origen_cancelacion_cita()
from public, anon, authenticated;

-- El dashboard escucha cancelaciones y otros cambios de citas en tiempo real.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'citas'
  ) then
    alter publication supabase_realtime add table public.citas;
  end if;
end $$;

-- Membresia interna sin recursion entre las politicas de tiendas y perfiles.
create or replace function public.pertenece_a_tienda(p_id_tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1 from public.tiendas t
        where t.id = p_id_tienda and t.user_id = auth.uid()
      )
      or exists (
        select 1 from public.perfiles p
        where p.tienda_id = p_id_tienda
          and p.user_id = auth.uid()
          and p.activo = true
      )
    );
$$;

revoke execute on function public.pertenece_a_tienda(uuid) from public, anon;
grant execute on function public.pertenece_a_tienda(uuid) to authenticated;

drop policy if exists "Lectura publica de tiendas" on public.tiendas;
drop policy if exists "Equipo consulta su tienda" on public.tiendas;
create policy "Equipo consulta su tienda"
on public.tiendas for select to authenticated
using (public.pertenece_a_tienda(id));

drop policy if exists "Lectura publica de profesionales" on public.profesionales;
drop policy if exists "Equipo consulta profesionales de su tienda" on public.profesionales;
create policy "Equipo consulta profesionales de su tienda"
on public.profesionales for select to authenticated
using (public.pertenece_a_tienda(id_tienda));

drop policy if exists "Lectura publica de servicios" on public.servicios;
drop policy if exists "Equipo consulta servicios de su tienda" on public.servicios;
create policy "Equipo consulta servicios de su tienda"
on public.servicios for select to authenticated
using (public.pertenece_a_tienda(id_tienda));

-- Disponibilidad publica ligada simultaneamente a tienda y profesional.
create or replace function public.obtener_horarios_ocupados(
  p_id_tienda uuid,
  p_id_barbero uuid,
  p_fecha date
)
returns table (hora_inicio time, hora_fin time)
language sql
stable
security definer
set search_path = public
as $$
  select c.hora_inicio, c.hora_fin
  from public.citas c
  join public.profesionales p
    on p.id_barbero = c.id_barbero
   and p.id_tienda = c.id_tienda
  where c.id_tienda = p_id_tienda
    and c.id_barbero = p_id_barbero
    and p.id_tienda = p_id_tienda
    and p.id_barbero = p_id_barbero
    and c.fecha = p_fecha
    and upper(c.estado) in ('PENDIENTE', 'CONFIRMADA')
    and c.hora_inicio is not null
    and c.hora_fin is not null;
$$;

revoke all on function public.obtener_horarios_ocupados(uuid, uuid, date) from public;
grant execute on function public.obtener_horarios_ocupados(uuid, uuid, date)
to anon, authenticated;

-- Historial privado del cliente sin depender de lectura directa de profesionales.
create or replace function public.obtener_mis_citas_reserva()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id_cita', c.id_cita,
        'fecha', c.fecha,
        'hora_inicio', c.hora_inicio,
        'hora_fin', c.hora_fin,
        'estado', c.estado,
        'servicio', c.servicio,
        'servicio_nombre', c.servicio_nombre,
        'profesionales', jsonb_build_object(
          'nombre_empleado', coalesce(p.nombre_empleado, 'No asignado')
        )
      ) order by c.fecha desc, c.hora_inicio desc
    ),
    '[]'::jsonb
  )
  from public.citas c
  left join public.profesionales p
    on p.id_barbero = c.id_barbero
   and p.id_tienda = c.id_tienda
  where auth.uid() is not null
    and c.user_id = auth.uid();
$$;

revoke execute on function public.obtener_mis_citas_reserva()
from public, anon;
grant execute on function public.obtener_mis_citas_reserva() to authenticated;

-- Bloqueos aplicados en base de datos, no solo en la interfaz.
create or replace function public.validar_cliente_bloqueado_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_telefono text;
begin
  if upper(coalesce(new.estado, '')) not in ('PENDIENTE', 'CONFIRMADA') then
    return new;
  end if;

  v_telefono := regexp_replace(coalesce(new.telefono_cliente, ''), '[^0-9]', '', 'g');

  if length(v_telefono) >= 7 and exists (
    select 1
    from public.clientes_bloqueados cb
    where cb.id_tienda = new.id_tienda
      and (cb.id_barbero is null or cb.id_barbero = new.id_barbero)
      and length(regexp_replace(coalesce(cb.telefono_cliente, ''), '[^0-9]', '', 'g')) >= 7
      and right(regexp_replace(coalesce(cb.telefono_cliente, ''), '[^0-9]', '', 'g'), 10)
          = right(v_telefono, 10)
  ) then
    raise exception
      'El cliente está bloqueado para reservar en esta tienda o con este profesional';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_validar_cliente_bloqueado_trigger on public.citas;
create trigger zz_validar_cliente_bloqueado_trigger
before insert or update of estado, id_tienda, id_barbero, user_id, telefono_cliente
on public.citas for each row
execute function public.validar_cliente_bloqueado_cita();

-- El cliente solo puede cancelar; no puede cambiar campos ocultos a la vez.
create or replace function public.validar_cancelacion_cliente_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and old.user_id = auth.uid()
     and not public.puede_acceder_cita(
       old.id_tienda, old.id_barbero, 'agenda_gestionar'
     ) then
    if upper(coalesce(old.estado, '')) not in ('PENDIENTE', 'CONFIRMADA')
       or upper(coalesce(new.estado, '')) <> 'CANCELADA' then
      raise exception 'El cliente únicamente puede cancelar una cita activa';
    end if;

    if (to_jsonb(new) - 'estado') is distinct from (to_jsonb(old) - 'estado') then
      raise exception
        'No se permite modificar los datos de la cita durante la cancelación';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists aa_validar_cancelacion_cliente_trigger on public.citas;
create trigger aa_validar_cancelacion_cliente_trigger
before update on public.citas for each row
execute function public.validar_cancelacion_cliente_cita();

revoke execute on function public.validar_reglas_cita()
from public, anon, authenticated;
revoke execute on function public.validar_cliente_bloqueado_cita()
from public, anon, authenticated;
revoke execute on function public.validar_cancelacion_cliente_cita()
from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.citas'::regclass
      and conname = 'citas_no_superpuestas'
  ) then
    alter table public.citas
      add constraint citas_no_superpuestas
      exclude using gist (
        id_barbero with =,
        tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') with &&
      )
      where (upper(estado) in ('PENDIENTE', 'CONFIRMADA'));
  end if;
end $$;
