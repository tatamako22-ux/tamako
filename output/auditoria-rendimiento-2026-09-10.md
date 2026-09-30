# Auditoría de rendimiento y crecimiento de Tamaku

Fecha: 10 de septiembre de 2026. Alcance: revisión del código local, consultas y SQL disponibles, dependencias, temporizadores y tamaños de archivos. No es una certificación de capacidad ni una prueba de carga. No se modificó código operativo durante esta auditoría.

## Dictamen

Tamaku tiene una base que permite optimizar sin reescribir la plataforma: páginas estáticas, consultas filtradas por negocio, llamadas paralelas y disponibilidad de reservas consultada por tienda, profesional y día. Sin embargo, hay riesgos concretos al crecer el historial y la concurrencia: consultas sin paginación, recargas periódicas completas y procesamiento de historiales en el navegador.

No es posible afirmar cuántos negocios soporta ni garantizar una velocidad sin conocer hosting, región y recursos de Supabase, volumen de datos, índices realmente desplegados y usuarios simultáneos. Muchos negocios poco activos y pocos negocios con grandes historiales generan cargas diferentes. Los cambios SEO de la etapa anterior no corrigen estos riesgos operativos.

## Hallazgos por prioridad

### Alta: historiales sin paginación y agregación en el navegador

Evidencia:

- `pages/clientes.html:1252`: `cargarClientes` consulta citas de toda la tienda, sin límite temporal ni paginación, y calcula visitas, gasto, categorías y listado en JavaScript.
- `assets/js/services/agenda.service.js:27`: `obtenerCategoriasClientes` solicita teléfonos de todo el historial. La caché dura 120 segundos y es local a cada pestaña; no evita que otros usuarios repitan la consulta.
- `assets/js/facturacion/facturacion.service.js:343`: `getFacturas` descarga facturas sin período ni paginación. Los filtros y resúmenes posteriores se calculan en el navegador.

Impacto: aumenta transferencia y trabajo del dispositivo con el historial. Si el servidor limita las filas devueltas, el resultado puede ser incompleto sin que el cliente lo detecte. El límite real de la API no fue comprobado. Elevarlo indiscriminadamente solo desplaza el problema.

Solución: consultas paginadas con orden estable y búsqueda en servidor; resúmenes SQL/RPC por negocio y período, independientes de las páginas del listado. La clasificación histórica de clientes debe conservar su definición; no basta con contar solo la página visible. Probar con volúmenes superiores al límite configurado de la API y comparar contra conteos de referencia.

### Alta: actualizaciones periódicas que multiplican consultas

Evidencia:

- `assets/js/dashboard/dashboard.overview.js:501`: recarga cada 12 segundos si la pestaña está visible, además de Realtime, foco y cambios de visibilidad.
- `assets/js/dashboard/dashboard.service.js:38`: una recarga del propietario normalmente realiza cinco solicitudes de datos y una sexta si hay caja abierta. Descarga también facturas y detalles de los últimos 14 días.
- `assets/js/agenda/core/agenda.controller.js:567`: agenda cada 15 segundos en escritorio o 30 en móvil, además de Realtime.
- `assets/js/core/cancellation-alerts.js:197`: una consulta adicional cada minuto visible, más Realtime y foco.

Estimación derivada del código, no medición: 60/12 = 5 recargas/minuto. Un panel del propietario implica aproximadamente 25–30 solicitudes de datos/minuto, antes de alertas, eventos y carga inicial. Cien pestañas equivalentes representan 2.500–3.000 solicitudes/minuto (aproximadamente 42–50 por segundo). No son necesariamente el mismo número de consultas SQL internas ni una predicción de saturación.

La agenda hace cuatro solicitudes por recarga con caché de categorías vigente y cinco cuando expira: citas del día, conteo semanal, bloqueos, citas futuras y, cuando corresponde, historial de categorías.

Solución: agrupar eventos, refrescar solo el bloque afectado y mantener un respaldo de sincronización menos frecuente/adaptativo, con backoff ante fallos. Conservar comprobaciones de reconexión para no mostrar disponibilidad obsoleta. Medir reducción de solicitudes con el mismo escenario y verificar que una reserva nueva siga apareciendo rápidamente.

### Alta: consultas superpuestas en agenda

`cargarCitasDelDia`, en `assets/js/agenda/core/agenda.controller.js:62`, no tiene la exclusión de carga que sí existe en el dashboard. Un cambio rápido de fecha/profesional, un evento y un temporizador pueden solaparse; una respuesta antigua puede escribir el estado después de una más reciente.

Solución: identificar cada carga, descartar respuestas obsoletas y agrupar solicitudes equivalentes; cancelar cuando sea posible. Probar con respuestas artificialmente demoradas y cambios rápidos de día/profesional. No basta un bloqueo global que descarte el último cambio solicitado por el usuario.

### Media-alta: búsqueda de reservas cercanas creciente

`assets/js/services/agenda.service.js`, dentro de `obtenerCitas`, obtiene todas las citas futuras activas de la tienda y recorre esa lista para cada cita visible. El trabajo crece aproximadamente con citas visibles × citas futuras, además del coste de comparar teléfonos/correos/usuarios y ordenar coincidencias.

Solución: definir el horizonte funcional de “cercana” y filtrar en servidor, o consultar coincidencias de los clientes visibles. Si la intención es detectar cualquier reserva futura, mantener esa semántica con una consulta específica. Agrupar por identidad en vez de volver a recorrer toda la lista por cada cita.

### Alta, pendiente de confirmar: índices y recursos reales de base de datos

Los SQL locales contienen algunos índices y una restricción GiST contra reservas superpuestas. No constituyen un inventario completo de producción y no prueban que estén ejecutados. No se concluye que falten índices en el servidor.

Revisar los planes reales de las consultas principales y políticas RLS. Candidatos a evaluar, no a crear automáticamente: citas por `(id_tienda, fecha, id_barbero)`, facturas por `(id_tienda, fecha_emision)`, bloqueos por tienda/teléfono y movimientos por tienda/cuenta/fecha. Revisar también los índices de columnas de joins y los usados por las políticas de autorización. El orden de columnas y posibles índices parciales depende de la consulta y distribución real de datos.

La guía de [optimización de Supabase](https://supabase.com/docs/guides/database/query-optimization) recomienda analizar planes y ajustar índices a filtros y ordenación. No se deben desactivar permisos para mejorar velocidad. Las pruebas de planes deben considerar el rol y RLS del usuario real, no únicamente una sesión administradora.

### Media: peso de imágenes y precarga de la PWA

Mediciones de archivos locales (MB decimales; no equivalen a bytes transferidos medidos en producción):

| Archivo | Bytes | Dimensiones reales |
|---|---:|---|
| dashboard-tamaku.png | 2.622.966 | 1536 × 1024 |
| icon-192.png | 889.860 | 1254 × 1254 |
| icon-512.png | 889.860 | 1254 × 1254 |

Los dos iconos tienen el mismo SHA-256: son copias idénticas y sus dimensiones no corresponden a las declaradas en el manifiesto. Solo esos tres archivos suman 4,40 MB locales. La portada pesa 83.638 bytes; gzip calculado localmente da 19.708 bytes, sin demostrar que el hosting lo esté aplicando. El peso más claro está en imágenes, no en el HTML.

`sw.js` precarga ambos iconos y numerosas pantallas internas al instalarse. El registro ocurre después de `load`, por lo que esta descarga no debe confundirse automáticamente con el bloqueo inicial del contenido. Puede consumir red y competir con uso posterior. Su estrategia de red primero no evita por sí sola solicitudes online; el caché HTTP del hosting no está verificado.

Solución: redimensionar iconos a sus tamaños reales, optimizar la captura con formato moderno y revisión visual, añadir dimensiones explícitas a la imagen y limitar la precarga inicial a recursos esenciales. No cachear indiscriminadamente respuestas de datos privados. Revisar comportamiento de actualización y recuperación offline antes de modificar el service worker.

### Media: la confirmación de reserva espera al correo

`pages/reserva.html:1147` espera `enviarCorreoConfirmacion` después de guardar la cita y antes de mostrar éxito. La función hace una solicitud a `/api/send-email`; `api/send-email.js` crea un transporte SMTP por solicitud y espera al envío. Por ello, la percepción de lentitud puede proceder del correo aunque la cita ya exista. No hay un timeout explícito de fetch en esa función del navegador.

Solución: confirmar en pantalla cuando la reserva quede persistida y gestionar el correo mediante cola/outbox con reintentos e idempotencia por cita. No basta con retirar `await` en el navegador: al cerrar la página el envío podría perderse. Probar SMTP lento/fallido y asegurar que no se duplican reservas ni correos.

### Media: cadena de arranque y dependencias externas

`assets/js/core/session.js:69` encadena validación de usuario, contexto, tienda y suscripción antes de cargar la pantalla. Son verificaciones necesarias, pero sus latencias se acumulan. Evaluar consolidar el contexto autorizado en una RPC sin omitir controles de acceso.

La portada carga Supabase desde CDN en el head; el dashboard carga jsPDF y QR aunque la acción de exportar/mostrar QR pueda no usarse. Evaluar carga bajo demanda y versiones fijadas. No se midió el impacto de estos CDN ni se recomienda una migración de framework como primera medida.

## Aspectos favorables

- Consultas centrales con filtro de tienda; disponibilidad pública acotada por profesional y día.
- Dashboard usa `Promise.all`, períodos en facturas, límites en cancelaciones/cierres y exclusión de cargas simultáneas.
- Realtime filtrado por tienda, temporizadores que omiten pestañas ocultas y varias limpiezas de canales al salir.
- SQL de reservas contempla conflictos de horario en base de datos. Su presencia en el repositorio no confirma su despliegue.

Estas decisiones ayudan, pero no eliminan el coste de refrescar historiales completos. [Supabase documenta](https://supabase.com/docs/guides/realtime/postgres-changes) que Postgres Changes añade comprobaciones de autorización por suscriptor; ampliar recursos no sustituye revisar la distribución de eventos.

## Plan para validar capacidad

1. Inventariar hosting, región, plan/compute de Supabase, límite de filas API, tamaño de tablas, índices, consumo y consultas lentas. Se adjunta `diagnostico-rendimiento-solo-lectura.sql` para consultar metadatos sin leer registros de clientes.
2. Medir en navegador móvil y escritorio: carga fría/caliente de portada y reserva; tiempo hasta agenda utilizable; cambio de fecha; listado de clientes; registro de reserva; errores y solicitudes por minuto con pantalla inactiva.
3. Preparar entorno separado con datos sintéticos y esquema/RLS equivalentes. Probar tiendas con historiales pequeños, medianos y grandes, incluyendo más filas que el límite API. No usar datos personales reales.
4. Probar concurrencia gradual (por ejemplo 5, 20 y 50 usuarios como escenarios iniciales, no capacidad prometida), con pausas humanas y mezcla de lectura, navegación y reservas. Medir percentiles p50/p95, errores, CPU, memoria, conexiones, E/S y retraso Realtime; detener el escalado si hay saturación o errores. Comparar una tienda concurrida con usuarios distribuidos entre tiendas.
5. Aplicar optimizaciones por bloques y repetir exactamente el escenario de referencia. Publicar gradualmente con versión recuperable.

Objetivos iniciales propuestos, no resultados actuales: API de lectura p95 ≤ 500 ms, agenda utilizable p95 ≤ 2 s en un dispositivo/red definidos, confirmación de reserva persistida p95 ≤ 2 s excluyendo entrega de correo. Ajustarlos a la infraestructura y necesidades reales.

Para la web pública, [Core Web Vitals](https://web.dev/articles/vitals) define como buenos LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1 al percentil 75. No se obtuvieron valores Lighthouse, CrUX ni métricas de campo de Tamaku. No hay navegador conectado en esta sesión.

## Orden recomendado

Primero: confirmar recursos/índices y línea base; reducir imágenes y corregir cargas superpuestas. Después: paginación/resúmenes y refrescos selectivos. A continuación: correo desacoplado y revisión de precarga/caché. Finalmente: prueba de concurrencia y ajuste de infraestructura según resultados. No comprar más capacidad como sustituto de corregir consultas crecientes.
