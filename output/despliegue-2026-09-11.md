# Despliegue de Tamaku — 11 de septiembre de 2026

Publicado en https://www.tamaku.co/ mediante la rama main de tatamako22-ux/tamako.

- Commit nuevo: e6255d40aa8a1626312eb23113739de43f57d1f6.
- Commit anterior: c39538bdf1d063ab4bccddb90e371329d1c6b043.
- Vercel confirmó `success / Deployment has completed`.
- Despliegue: https://vercel.com/tatamakos-projects/tamako/fWbJnaodH1PoLPA6gSTdadjjurEV
- Copia aislada usada para publicar: `.publish-work/release-20260911`. Se conserva el árbol de trabajo original con sus cambios locales.

Incluye SEO, optimización de recursos/lecturas y mensajes integrados. Los informes de auditoría y la carpeta ajena output/pagina_ventas no se publicaron.

Validación: 16 pruebas automatizadas y prueba SQL PostgreSQL/PGlite satisfactorias. Verificación HTTP 200 y contenido esperado en inicio, agenda, clientes, facturación, superadmin, notificaciones JS/CSS, servicio de rendimiento, imagen optimizada, robots y sitemap. Service worker publicado con versión tamaku-v27-messages. No se realizaron escrituras de prueba sobre clientes, pagos ni reservas, ni se verificaron interactivamente sesiones autenticadas.

Pendiente: ejecutar supabase/rendimiento_resumenes_v1.sql en el proyecto smibbddmwgdmqpwsuaqr. El archivo está versionado pero NO se ha ejecutado remotamente: no hay conexión administrativa disponible ni navegador conectado. Se solicitó al usuario abrir una sesión de Supabase. Las pantallas mantienen el respaldo compatible cuando faltan las RPC; la reducción de transferencia mediante esas funciones todavía depende de instalarlas. No se ejecutaron otras migraciones antiguas.

Si fuera necesario revertir la aplicación, restaurar el despliegue anterior correspondiente a c39538b en Vercel. No hay cambios remotos de base de datos que revertir en este despliegue.
