# Tamaku: primera mejora comercial y SEO

Estado: implementado y verificado localmente; sin publicación en producción.

## Cambios incluidos

- `index.html`: mensaje de agenda y CRM para negocios de belleza; sección corporativa centrada en el producto; beneficios con descripciones concretas; navegación a Planes; moneda COP explícita sin cambiar importes.
- Portada: título y descripción SEO, canonical a `https://www.tamaku.co/`, Open Graph y Twitter con la captura existente del producto; entidad Organization enlazada al SoftwareApplication existente. No se añadieron reseñas, cifras de clientes ni promesas de resultados.
- El encabezado del acceso pasa de H1 a H2 conservando sus estilos. Los scripts de operación y los destinos de navegación existentes son idénticos a los anteriores.
- `pages/servicios.html`: título, descripción, robots y canonical propios.
- `robots.txt`: permite rastreo y declara el sitemap. No sustituye autenticación ni protege páginas privadas.
- `sitemap.xml`: incluye únicamente portada y página comercial de planes, sin rutas operativas ni parámetros de clientes.
- `dev-server.js`: tipos MIME para servir TXT y XML en desarrollo.

## Validación realizada

- Comparación automatizada contra HEAD: scripts operativos de la portada y destinos de enlaces existentes conservados.
- JSON de los datos estructurados y sintaxis JavaScript válidos.
- Un H1 en portada, identificadores únicos, anclas internas y archivos enlazados existentes.
- HTTP local 200 para portada, planes, registro, reservas, robots y sitemap; tipos MIME correctos.
- `git diff --check` sin errores de whitespace.

Estas comprobaciones no constituyen una prueba de registro, inicio de sesión ni reserva contra producción. No se crearon cuentas, citas ni pagos. No se pudo realizar revisión visual porque el navegador de la sesión no está disponible.

## Publicación controlada

1. Crear una versión de prueba con estos archivos y guardar el identificador de la versión actualmente publicada para poder restaurarla.
2. Revisar la portada en móvil y escritorio, menú, modal de acceso, cierre del modal, enlaces de planes, registro y descarga del portafolio. Comprobar acceso y reserva con cuentas/datos de prueba en el entorno correspondiente.
3. Confirmar en el hosting que `www.tamaku.co` es el dominio de destino. El canonical es una preferencia SEO: este cambio no configura redirecciones del servidor. Si el destino real es otro, alinear canonical, metadatos sociales y sitemap antes de publicar.
4. Publicar los cambios del sitio mediante el procedimiento habitual del hosting. `dev-server.js` solo es necesario si ese servidor se usa para servir archivos; no sustituye la configuración del hosting.
5. Verificar en producción respuestas 200, contenido y tipos MIME de `/robots.txt` y `/sitemap.xml`; comprobar que no devuelvan una página HTML de fallback. Confirmar los metadatos en el HTML servido y los flujos de acceso existentes.
6. Añadir el sitemap en Search Console e inspeccionar las dos URLs. Revisar indexación y rendimiento durante las semanas siguientes; no hay garantía de posicionamiento ni de plazos de indexación.
7. Si aparece una regresión, restaurar la versión anterior mediante el hosting y repetir las comprobaciones de acceso y reservas.

## Pendientes fuera de este primer cambio

- Confirmar Search Console, dominio preferido y redirecciones, y medir rendimiento móvil real.
- Revisar individualmente la indexación de rutas operativas y de registro; no se aplicó un bloqueo general a `/pages/`, ya que contiene planes y reservas públicas.
- Validar condiciones comerciales antes de añadir impuestos, cancelación, soporte o costes adicionales a la portada.
- Medición de conversiones, testimonios y páginas por tipo de negocio en etapas posteriores.
- El service worker existente usa red primero y caché como respaldo. No se cambió su ciclo de actualización: sin conexión puede seguir mostrando la portada anterior guardada hasta una futura actualización de caché.

Los archivos que ya existían sin seguimiento en `output/` no se modificaron.
