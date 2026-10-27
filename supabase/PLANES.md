Planes comerciales — octubre de 2026
===================================

| Nombre público | Código conservado | COP / mes | Usuarios activos, incluido propietario |
| --- | --- | ---: | ---: |
| Plata | BASICO | 69.900 | 1 |
| Zafiro | PRO | 119.900 | 3 |
| Diamante | PREMIUM | 199.000 | 10 |

Activación
----------

En una instalación que ya tiene suscripciones, ejecutar `planes_comerciales_20261027.sql`
y después `planes_operacion_20261027.sql` en Supabase SQL Editor. Si ya se ejecutó el
primer archivo, solo falta el segundo. Requiere haber instalado `superadmin_suscripciones.sql`,
`superadmin_suscripciones_v2.sql` y `planes_capacidades.sql`, en ese orden.
Publicar también los archivos web modificados. Esta migración no se ha ejecutado
contra la base remota desde este entorno; tampoco se ha publicado el sitio.

Conservar los códigos y UUID evita mover suscripciones o romper las referencias de
pagos existentes. Los montos de pagos anteriores no cambian. Los nombres asociados a
esos pagos pasan a mostrar el nombre actual del plan. Las URLs nuevas usan plata,
zafiro y diamante; las URLs antiguas siguen funcionando.

Superadministrador → Tiendas → seleccionar una tienda → Cambiar plan.
El cambio conserva estado, fechas y pagos. Durante la prueba cambia únicamente
el plan solicitado: la prueba sigue ofreciendo Diamante hasta su vencimiento.
Para cobrar y activar un periodo se conserva el formulario Registrar pago manual.

Los límites cuentan usuarios distintos y al propietario, tenga o no una fila en
perfiles. No cuentan perfiles inactivos. Se comprueban altas, reactivaciones,
traslados entre tiendas y cambios de plan, incluidos los efectuados al registrar
pagos. Una reducción que exceda el cupo se rechaza: el administrador debe elegir
qué accesos desactivar previamente. No se desactivan personas automáticamente.
Los profesionales no tienen un cupo adicional; no equivalen a usuarios de acceso.

Estado de las funciones
----------------------

Todos los planes permiten los módulos actuales de agenda, clientes, dashboard y
ventas. Los informes se habilitan para Zafiro y Diamante y también requieren el
permiso `reportes_ver` del usuario. El servicio consulta la función de autorización
de Supabase antes de leer los datos para generar el informe. Esto restringe la
función de informes; los datos de ventas siguen disponibles en Plata.

El módulo Crecimiento y sedes implementa:

- Zafiro/Diamante: campañas con presupuesto, contacto, mensaje, fecha y estado;
  oportunidades en etapas Nueva, Contactada, Propuesta, Ganada y Perdida.
- Diamante: tareas de seguimiento con contacto, notas, próxima acción y estado.
- Diamante: creación de sedes reales (tiendas separadas), cambio de sede y uso de
  sus agendas, servicios, profesionales, clientes y ventas existentes.
- Edición, búsqueda, archivo y restauración de registros comerciales. La interfaz
  abre WhatsApp solo cuando se registra el consentimiento del contacto. El usuario
  revisa y envía el mensaje; no hay envíos masivos, automáticos ni integración de
  anuncios o proveedores de email marketing.
- Servicio al cliente: enlace al WhatsApp de TAMAKU desde Mi plan.

Las operaciones comerciales están sujetas a RLS, pertenencia a la tienda, permiso
de gestión de clientes y suscripción vigente. Crear o cambiar de sede solo está
disponible al propietario. La relación de sedes se modifica exclusivamente por RPC.
La suscripción de la principal se hereda; sus usuarios distintos se cuentan una sola
vez entre todas las sedes. El superadministrador factura y cambia el plan en la
principal; las sedes no generan cobros independientes. Al perder Multi-Sede, los
datos se conservan y el propietario vuelve a la principal.

La prueba obtiene las funciones y límites del plan activo con mayor precio, incluso
si se reactiva una prueba en una tienda que antes estaba en Plata o Zafiro.

Verificación
------------

Pruebas locales:

    node --test tests/planes.test.js tests/crecimiento.test.js tests/performance.test.js tests/notifications.test.cjs
    node tests/planes-sql.mjs

Las pruebas de componentes usan LinkeDOM en `tmp/ui-tests/node_modules` y las SQL
usan PostgreSQL/PGlite en `tmp/performance-sql/node_modules`. Estas dependencias de
desarrollo no se publican. Las pruebas SQL verifican permisos, aislamiento, cupos,
reactivación, descensos, conservación de registros y de fechas/pagos, sedes y prueba
del plan más caro en una base efímera. No conectan a producción.

Pendiente verificar en una base de pruebas con los scripts instalados:

1. Un usuario ordinario no puede ejecutar `cambiar_plan_tamaku`.
2. Un superadministrador puede subir y bajar de plan sin crear pagos ni cambiar fechas.
3. Plata admite al propietario y rechaza un segundo acceso activo; Zafiro admite
   dos adicionales y Diamante nueve adicionales. Reactivar accesos respeta el cupo.
4. Dos altas simultáneas para el último cupo permiten solo una.
5. Un descenso con exceso de usuarios se rechaza, también desde el registro de pago,
   sin dejar un pago parcial (la función RPC se ejecuta en una transacción).
6. Una prueba conserva Diamante, actualiza el plan solicitado y aplica el cupo del
   plan pagado al activarlo.
7. Suspender una tienda con exceso de usuarios sigue siendo posible.
8. Plata no inicia ni exporta informes; Zafiro/Diamante con permisos sí lo hacen.

Las verificaciones en producción requieren una conexión administrativa y cuentas
de prueba. Las pruebas locales no sustituyen su ejecución, en particular la prueba
de altas simultáneas con conexiones independientes.
