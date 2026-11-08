-- Requiere usuarios_agenda_propietario_20261108.sql y los limites de planes.
-- No cambia integrantes existentes. Solo archiva cuando el propietario lo solicita.
begin;
create table if not exists public.tamaku_equipo_retirado (
 id_tienda uuid not null references public.tiendas(id),
 id_profesional text not null,
 retirado_at timestamptz not null default now(),
 primary key(id_tienda,id_profesional)
);
alter table public.tamaku_equipo_retirado enable row level security;
revoke all on public.tamaku_equipo_retirado from anon,authenticated;
grant select on public.tamaku_equipo_retirado to anon,authenticated;
drop policy if exists "Consultar retirados" on public.tamaku_equipo_retirado;
create policy "Consultar retirados" on public.tamaku_equipo_retirado for select using(true);

create or replace function public.retirar_integrante_tamaku(p_tienda uuid,p_profesional text)
returns void language plpgsql security definer set search_path=public as $$
declare v_propietario uuid; v_prof profesionales%rowtype;
begin
 select user_id into v_propietario from tiendas where id=p_tienda for update;
 if auth.uid() is null or auth.uid() is distinct from v_propietario then raise exception 'Solo el propietario puede retirar integrantes'; end if;
 select * into v_prof from profesionales where id_tienda=p_tienda and id_barbero::text=p_profesional for update;
 if not found then raise exception 'El profesional no pertenece a esta tienda'; end if;
 if v_prof.propietario_user_id is not null or exists(select 1 from perfiles where tienda_id=p_tienda and id_profesional=v_prof.id_barbero and user_id=v_propietario) then
   raise exception 'Configura la agenda del propietario desde Usuarios';
 end if;
 -- No borrar profesionales ni historial; quitar todos los accesos vinculados solo aqui.
 update perfiles set activo=false where tienda_id=p_tienda and id_profesional=v_prof.id_barbero;
 insert into tamaku_equipo_retirado(id_tienda,id_profesional) values(p_tienda,p_profesional) on conflict do nothing;
end; $$;
revoke all on function public.retirar_integrante_tamaku(uuid,text) from public;
grant execute on function public.retirar_integrante_tamaku(uuid,text) to authenticated;

-- Alta atomica de profesional + perfil. Auth se crea desde el servidor.
create or replace function public.crear_integrante_tamaku(p_actor uuid,p_tienda uuid,p_usuario uuid,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_prof profesionales%rowtype; v_perfil perfiles%rowtype; v_id text; v_rol text;
begin
 perform 1 from tiendas where id=p_tienda and user_id=p_actor for update;
 if not found then raise exception 'Solo el propietario puede agregar integrantes'; end if;
 if p_usuario=p_actor then raise exception 'El propietario ya tiene su acceso'; end if;
 v_rol:=p_datos->>'rol';
 if v_rol not in ('EMPLEADO','ADMINISTRADOR') or v_rol is null then raise exception 'Rol invalido'; end if;
 if nullif(trim(p_datos->>'nombre'),'') is null then raise exception 'Nombre obligatorio'; end if;
 v_id:=nullif(p_datos->>'id_profesional','');
 if v_id is not null then
   select * into v_prof from profesionales where id_tienda=p_tienda and id_barbero::text=v_id for update;
   if not found then raise exception 'El profesional no pertenece a esta tienda'; end if;
   if v_prof.propietario_user_id is not null or exists(select 1 from perfiles where tienda_id=p_tienda and id_profesional=v_prof.id_barbero) then raise exception 'El profesional ya tiene un usuario vinculado'; end if;
   if exists(select 1 from tamaku_equipo_retirado where id_tienda=p_tienda and id_profesional=v_id) then raise exception 'El profesional esta retirado'; end if;
 elsif v_rol='EMPLEADO' then
   insert into profesionales(id_tienda,nombre_empleado,puesto_asignado,modo_agenda,horario_inicio,horario_fin,horario_semanal)
   values(p_tienda,trim(p_datos->>'nombre'),1,'auto','09:00','18:00','{}'::jsonb) returning * into v_prof;
 end if;
 insert into perfiles(user_id,tienda_id,id_profesional,nombre,email,rol,activo,permisos)
 values(p_usuario,p_tienda,v_prof.id_barbero,trim(p_datos->>'nombre'),p_datos->>'email',v_rol,true,coalesce(p_datos->'permisos','{}'::jsonb)) returning * into v_perfil;
 return to_jsonb(v_perfil);
end; $$;
revoke all on function public.crear_integrante_tamaku(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crear_integrante_tamaku(uuid,uuid,uuid,jsonb) to service_role;

-- Impide nuevas reservas para retirados aun con una pagina antigua abierta.
create or replace function public.validar_profesional_retirado_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' then
   if new.id_barbero is not distinct from old.id_barbero and new.id_tienda is not distinct from old.id_tienda then return new; end if;
 end if;
 perform 1 from profesionales where id_tienda=new.id_tienda and id_barbero=new.id_barbero for share;
 if exists(select 1 from tamaku_equipo_retirado where id_tienda=new.id_tienda and id_profesional=new.id_barbero::text) then raise exception 'Este profesional fue retirado del equipo'; end if;
 return new;
end; $$;
drop trigger if exists trg_profesional_retirado on public.citas;
create trigger trg_profesional_retirado before insert or update of id_barbero,id_tienda on public.citas for each row execute function public.validar_profesional_retirado_tamaku();
create or replace function public.validar_acceso_equipo_tamaku()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.id_profesional is null then return new; end if;
 perform 1 from profesionales where id_tienda=new.tienda_id and id_barbero=new.id_profesional for share;
 if not found then raise exception 'El profesional no pertenece a esta tienda'; end if;
 if new.activo is true and exists(select 1 from tamaku_equipo_retirado where id_tienda=new.tienda_id and id_profesional=new.id_profesional::text) then
   raise exception 'No puedes reactivar el acceso de un integrante retirado';
 end if;
 return new;
end; $$;
drop trigger if exists trg_acceso_equipo on public.perfiles;
create trigger trg_acceso_equipo before insert or update of activo,id_profesional,tienda_id on public.perfiles for each row execute function public.validar_acceso_equipo_tamaku();
notify pgrst,'reload schema';
commit;
