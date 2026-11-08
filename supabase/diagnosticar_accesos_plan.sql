-- Solo lectura. Ejecutar en Supabase SQL Editor para identificar los accesos.
-- Cambia BARBER SHOP si la tienda tiene otro nombre; incluye todas sus sedes.
with principal as (
  select id, nombre from public.tiendas where upper(trim(nombre))='BARBER SHOP'
), grupo as (
  select id as principal_id, id as tienda_id from principal
  union
  select p.id, s.tienda_sede from principal p
  join public.tamaku_sedes s on s.tienda_principal=p.id
), accesos as (
  select g.principal_id, t.user_id, t.id tienda_id, 'PROPIETARIO' origen
  from grupo g join public.tiendas t on t.id=g.tienda_id
  union all
  select g.principal_id, p.user_id, p.tienda_id, 'PERFIL ACTIVO' origen
  from grupo g join public.perfiles p on p.tienda_id=g.tienda_id
  where p.activo=true
)
select principal.nombre tienda_principal, a.user_id, u.email,
  string_agg(distinct t.nombre, ', ') tiendas,
  string_agg(distinct a.origen, ', ') origen,
  public.total_usuarios_plan_tamaku(principal.id) total_accesos_distintos
from accesos a join principal on principal.id=a.principal_id
join public.tiendas t on t.id=a.tienda_id
left join auth.users u on u.id=a.user_id
where a.user_id is not null
group by principal.id, principal.nombre, a.user_id, u.email
order by principal.nombre, u.email;
