-- Precios mensuales COP y cupos. Conserva IDs, funciones, pagos y fechas.
-- Ejecutar despues de las migraciones de planes existentes.
begin;
update public.tamaku_planes p set
  precio_mensual=v.precio, limite_usuarios=v.usuarios
from (values ('BASICO',34999,1),('PRO',69999,4),('PREMIUM',159999,10))
  as v(codigo,precio,usuarios)
where p.codigo=v.codigo;
notify pgrst,'reload schema';
commit;
