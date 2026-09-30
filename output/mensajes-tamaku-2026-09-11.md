# Mensajes integrados de Tamaku

Se reemplazaron 112 llamadas a alert, confirm y prompt del navegador por componentes propios. Todas las pantallas cargan el sistema compartido de notificaciones y su estilo. Liquidaciones y superadministración usan el mismo componente.

Los avisos distinguen éxito, error, advertencia e información. Las confirmaciones esperan la respuesta antes de continuar; cancelar o pulsar Escape no autoriza operaciones. Los formularios emergentes validan dentro de la página. Incluye navegación por teclado, restauración del foco, texto seguro, límite de avisos simultáneos y estilos adaptables a móviles.

Validación automatizada: `node --test tests/notifications.test.cjs tests/performance.test.js` (16 pruebas). Las pruebas de notificaciones usan acorn y linkedom instalados de forma aislada en tmp/ui-tests. Se comprueba también que el código de las páginas y módulos no conserve llamadas nativas a alert/confirm/prompt.

Vista de ejemplos: http://localhost:3100/output/notificaciones-preview.html con el servidor local iniciado. No realiza operaciones sobre clientes ni datos. Falta revisión visual interactiva porque no hay navegador conectado disponible en esta sesión.

Los cambios están en el proyecto local, sin despliegue a producción. No requieren ejecutar SQL. Al publicar, incluir las páginas, módulos, estilos y sw.js modificados; las referencias de recursos y la versión de caché se actualizaron. Los permisos de instalación de la PWA y otros permisos del navegador pertenecen al navegador y no pueden personalizarse desde el sitio.
