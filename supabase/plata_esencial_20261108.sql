-- Cambia solo el catalogo Plata. No modifica pagos, fechas, usuarios ni otros planes.
begin;
update public.tamaku_planes set precio_mensual=34999,limite_usuarios=1,
 funcionalidades='{"dashboard":true,"agenda":true,"clientes":true,"profesionales":true,"galeria":true,"comunicados":true,"usuarios":true,"ajustes":true,"facturacion":false,"caja":false,"reportes":false,"tienda":false,"marketing":false,"crm_avanzado":false,"multisede":false,"servicio_cliente":false}'::jsonb
where codigo='BASICO';
notify pgrst,'reload schema';
commit;
