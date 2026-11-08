begin;
-- Configuracion por tienda; el identificador profesional se conserva como texto.
create table if not exists public.tamaku_agenda_propietario (
  id_tienda uuid primary key references public.tiendas(id),
  id_profesional text,
  visible boolean not null default false
);
alter table public.tamaku_agenda_propietario enable row level security;
grant select on public.tamaku_agenda_propietario to anon, authenticated;
revoke insert,update,delete on public.tamaku_agenda_propietario from anon,authenticated;
drop policy if exists "Consultar agenda propietario" on public.tamaku_agenda_propietario;
create policy "Consultar agenda propietario" on public.tamaku_agenda_propietario for select using(true);

-- El propietario tiene un profesional propio, nunca selecciona uno del equipo.
alter table public.profesionales add column if not exists propietario_user_id uuid;
create unique index if not exists profesional_propietario_tienda_idx
on public.profesionales(id_tienda,propietario_user_id) where propietario_user_id is not null;
create or replace function public.configurar_mi_agenda_tamaku(p_tienda uuid,p_visible boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_tienda tiendas%rowtype; v_profesional text;
begin
  select * into v_tienda from tiendas where id=p_tienda and user_id=auth.uid() for update;
  if not found then raise exception 'Solo el propietario puede configurar su agenda'; end if;
  if p_visible is null then raise exception 'Selecciona si apareces en agenda'; end if;
  select id_barbero::text into v_profesional from profesionales
    where id_tienda=p_tienda and propietario_user_id=auth.uid();
  if p_visible and v_profesional is null then
    insert into profesionales(id_tienda,propietario_user_id,nombre_empleado,puesto_asignado,
      modo_agenda,horario_inicio,horario_fin,horario_semanal)
    values(p_tienda,auth.uid(),coalesce(nullif(v_tienda.propietario,''),v_tienda.nombre),1,
      'auto','09:00','18:00','{}'::jsonb) returning id_barbero::text into v_profesional;
  end if;
  insert into tamaku_agenda_propietario(id_tienda,id_profesional,visible)
  values(p_tienda,v_profesional,p_visible)
  on conflict(id_tienda) do update set id_profesional=excluded.id_profesional,visible=excluded.visible;
end; $$;
revoke all on function public.configurar_mi_agenda_tamaku(uuid,boolean) from public;
grant execute on function public.configurar_mi_agenda_tamaku(uuid,boolean) to authenticated;
-- Retirar el selector antiguo para evitar vincular al propietario con un empleado.
drop function if exists public.configurar_agenda_propietario_tamaku(uuid,text,boolean);

create or replace function public.eliminar_usuario_tienda_tamaku(p_tienda uuid,p_perfil uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_propietario uuid; v_usuario uuid;
begin
  select user_id into v_propietario from tiendas where id=p_tienda for update;
  if v_propietario is distinct from auth.uid() or auth.uid() is null then
    raise exception 'Solo el propietario puede eliminar accesos de esta tienda';
  end if;
  select user_id into v_usuario from perfiles where id=p_perfil and tienda_id=p_tienda for update;
  if not found then raise exception 'El acceso no pertenece a esta tienda'; end if;
  if v_usuario=v_propietario then raise exception 'No puedes eliminar el acceso del propietario'; end if;
  delete from perfiles where id=p_perfil and tienda_id=p_tienda;
end; $$;
revoke all on function public.eliminar_usuario_tienda_tamaku(uuid,uuid) from public;
grant execute on function public.eliminar_usuario_tienda_tamaku(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
