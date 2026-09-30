# Mejoras de rendimiento de Tamaku

Estado: implementadas en el proyecto local. Sin despliegue ni modificaciones a Supabase de producción.

## Resultado

- Tres imágenes optimizadas: de 4.402.686 a 429.969 bytes, una reducción del 90,2 %. La captura mantiene 1536 × 1024 y usa JPEG; iconos PNG de 192 y 512 píxeles reales. Originales conservados. Imágenes optimizadas inspeccionadas visualmente.
- La PWA precarga cinco recursos esenciales. Las pantallas internas se guardan al visitarlas; no se precargan todas para cada visitante. Excluye escrituras, otras procedencias, API y URLs parametrizadas. Mantiene red primero y respaldo offline para los recursos permitidos. Una pantalla no visitada no estará disponible sin conexión.
- Agenda: lecturas serializadas, solicitudes pendientes agrupadas y respuestas obsoletas descartadas. Los fallos de lectura no sustituyen las citas visibles por una lista vacía. Coincidencias de clientes indexadas en memoria, conservando teléfono/usuario/correo y eliminando duplicados.
- Panel: los eventos llegados durante una carga conservan un refresco pendiente. Respaldo cada 60 segundos con Realtime conectado y cada 30 segundos sin conexión Realtime. Los cambios siguen actualizando el panel mediante eventos agrupados. Agenda mantiene respaldo de 15/30 segundos cuando Realtime no está conectado y 60 segundos cuando sí lo está. No se consulta periódicamente con la pestaña oculta.
- Menú y pantalla comparten una validación de sesión simultánea. No se reutiliza indefinidamente una autorización antigua.
- Clientes y facturas: páginas de 50 resultados y búsqueda con espera de 300 ms. Las RPC nuevas filtran y paginan en servidor, devolviendo indicadores calculados sobre el conjunto completo autorizado, no solo sobre los 50 registros visibles.
- Compatibilidad: si las RPC todavía no existen, el código recupera el historial en bloques y pagina la presentación. No confunde errores de permisos con funciones ausentes. Este respaldo conserva datos completos pero sigue transfiriendo el historial; la mejora principal de transferencia requiere instalar el SQL.
- Las facturas del período del panel se recuperan por bloques para evitar truncar los cálculos cuando superen el límite API.
- Reservas: confirma en pantalla inmediatamente después del guardado. Luego informa del resultado real del correo. Se mantiene el envío esperado y se añaden tiempos máximos de conexión/actividad SMTP. Esto no implementa una cola durable: si se cierra la página antes de solicitar el envío, la entrega no queda garantizada.

## SQL listo para revisión y prueba

Archivo: `supabase/rendimiento_resumenes_v1.sql`.

Añade cuatro funciones: visitas históricas por cliente, conteo de agenda, página/resumen de clientes y página/resumen de facturas. Todas usan SECURITY INVOKER, comprueban pertenencia a la tienda y mantienen RLS. Solo se concede ejecución a authenticated; anon no puede ejecutarlas. No se cambian los datos, precios ni políticas existentes.

La migración verifica que RLS esté activo en las tablas necesarias y que exista `pertenece_a_tienda(uuid)`. Si falta una precondición, se detiene. No resolver ese error desactivando RLS ni ejecutando otras migraciones antiguas a ciegas: revisar primero el esquema del proyecto.

## Comprobaciones realizadas

- `node --test tests/performance.test.js`: 9 pruebas de lecturas concurrentes, eventos pendientes, errores, paginación con límite API inferior al solicitado, identidad de clientes, temporizadores del panel, comportamiento de caché y sintaxis/recursos HTML.
- `node tests/performance-sql.mjs`: PostgreSQL local con PGlite 0.5.8 y datos ficticios, sin acceder a Supabase. Migración ejecutada dos veces; 1.207 citas y 1.207 facturas de prueba; páginas, búsqueda, bloqueos, indicadores completos y conteos. Dos tiendas: aislamiento de datos bajo RLS y rechazo de ejecución anónima comprobados.
- Sintaxis de módulos JavaScript cambiados y respuestas HTTP locales 200 para páginas principales, recursos nuevos, servicio y service worker.
- No hubo prueba visual de las pantallas ni prueba real de login, registro, reserva o envío SMTP; el navegador conectado no está disponible. Las imágenes sí se inspeccionaron con el visor local.

El test SQL usa un esquema sintético con las columnas requeridas. Su éxito no certifica que el esquema real coincida ni reproduce todas las políticas y triggers de producción. No es una prueba de capacidad/concurrencia de Supabase.

## Activación segura

1. Guardar la versión actualmente publicada y comprobar recuperación de la base de datos antes de intervenir producción.
2. Ejecutar el SQL primero en una copia de prueba con el esquema real. Comprobar la visualización de propietario y empleado con permisos limitados; contrastar totales y búsquedas con el historial de referencia. Las cifras de Nuevos conservan el criterio previo de última visita en el mes, no se redefinen como primera visita.
3. Probar los archivos actualizados en el entorno de prueba: cambios rápidos de día/profesional, pérdida y recuperación de Realtime, filtros al iniciar carga, paginación, edición de factura, bloqueos, navegación atrás, reserva con correo lento/fallido y visita móvil con instalación PWA.
4. Con la prueba aprobada, instalar la migración aditiva en la base correcta y publicar todos los archivos cambiados y nuevos. Se actualizaron las versiones de entrada para módulos de agenda, panel, facturas y PWA. Si el hosting retiene módulos con caché agresiva, invalidar la caché del despliegue. El service worker también cambia de versión.
5. Recargar las pantallas tras instalar el SQL: una pestaña que detectó funciones ausentes mantiene el modo compatible hasta recargarse. Confirmar en Network llamadas exitosas a las cuatro RPC y ausencia de historiales completos en clientes/facturas.
6. Medir solicitudes por minuto, p95 de lecturas, tiempo de agenda utilizable y errores. La reducción de imágenes no equivale a un porcentaje garantizado de mejora de velocidad total.

Si hay regresión, restaurar el despliegue anterior. Las cuatro funciones SQL son nuevas y pueden permanecer sin que el código anterior las use; no es necesario modificar datos para revertir el frontend. No borrar funciones mientras haya usuarios con la versión nueva abierta.

## Límites y siguiente validación

Falta conocer hosting, región/compute de Supabase, volumen real, índices y RLS desplegados. No se añadieron índices sin ver sus definiciones y planes de ejecución. Los resúmenes reducen transferencia, pero calcular el historial completo todavía consume trabajo de base de datos: medir antes de elegir índices o materialización.

La agenda todavía consulta futuras reservas de la tienda para detectar coincidencias; ahora las procesa mediante índice en memoria. No se cambió su alcance funcional a un horizonte arbitrario. Los reportes detallados de otros módulos y alertas globales requieren medición adicional; no se afirma que todo el proyecto haya quedado sin límites de escalabilidad.

Una cola durable de correo con reintentos/idempotencia y una prueba de concurrencia en entorno aislado requieren configuración adicional del backend. No se ejecutaron pruebas de carga contra clientes reales ni se garantiza una cantidad de negocios simultáneos.

Para repetir la prueba SQL, instalar únicamente la dependencia de test: `npm.cmd install --prefix tmp/performance-sql --no-save --ignore-scripts @electric-sql/pglite@0.5.8`. No es una dependencia de producción ni modifica `package.json`.
