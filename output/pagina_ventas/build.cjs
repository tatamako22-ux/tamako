const fs = require('fs');
const path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.original.html'), 'utf8').replace(/\r\n/g, '\n');
html = html.replace('<html>', '<html lang="es">').replace('<head>', '<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="theme-color" content="#EF4123">\n<title>Ventas Corporativas | Flota La Macarena</title>');
html = html.replace(/<style>[\s\S]*?<\/style>/, '<style>\n' + fs.readFileSync(path.join(root, 'modern.css'), 'utf8') + '\n</style>');
html = html.replace('<h1>Ventas Corporativas</h1>', '<div class="header-brand"><span class="brand-mark" aria-hidden="true">M</span><div><span class="brand-name">FLOTA LA MACARENA</span><h1>Ventas Corporativas</h1></div></div><button id="menu-toggle" class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-navigation">☰ Menú</button>');
html = html.replace('<nav class="sidebar">', '<nav class="sidebar" id="main-navigation" aria-label="Recursos por categoría"><div class="sidebar-label">TU ESPACIO DE TRABAJO</div>');
html = html.replace('<main class="main-content">', `<main class="main-content" id="main-content">
<section class="hero"><div class="eyebrow">CONECTAMOS TU GESTIÓN</div><h2>Todo a un clic.</h2><p>Encuentra las herramientas, documentos y novedades de Ventas Corporativas.</p><span class="hero-badge">Flota La Macarena · Colombia</span><div class="hero-orbit" aria-hidden="true"></div></section>
<section class="resources" aria-labelledby="resources-title"><div class="section-heading"><div><span class="eyebrow">ACCESOS DE TRABAJO</span><h2 id="resources-title">Tus herramientas</h2></div><span id="resource-count" class="resource-count" role="status"></span></div><label class="search-label" for="resource-search">Buscar por herramienta o categoría</label><input id="resource-search" type="search" placeholder="Ej. tiquetes, Sanitas, tarifario…" autocomplete="off"><div id="resource-grid" class="resource-grid"></div><p id="no-results" hidden>No encontramos coincidencias. Prueba con otro nombre.</p></section>`);
// El tablón abre la página; los accesos complementarios quedan plegados debajo.
html = html.replace(/<section class="hero">[\s\S]*?<\/section>\n/, '');
const resources = html.match(/<section class="resources"[\s\S]*?<\/section>/)[0];
html = html.replace(resources, '');
html = html.replace('<div class="content-title-container">', '<section class="notice-board" aria-labelledby="board-title"><div class="board-heading"><span class="board-symbol" aria-hidden="true">✦</span><div class="content-title-container">');
html = html.replace('<h2 class="content-title">Tablón de Comunicados</h2>', '<div><span class="board-kicker">AL DÍA CON NUESTRO EQUIPO</span><h2 class="content-title" id="board-title">Tablón de Comunicados</h2><p class="board-subtitle">Las novedades que nos conectan.</p></div>');
html = html.replace('<div id="comment-container"></div>', '</div><div class="board-ribbon"><span>COMUNICACIÓN INTERNA</span><span>Flota La Macarena</span></div><div id="comment-container" aria-live="polite"></div>');
html = html.replace('Cargando comunicados...</div>', 'Cargando comunicados...</div></section><details class="tools-drawer"><summary><span>Herramientas y enlaces</span><span class="tools-hint">Buscar accesos <span aria-hidden="true">＋</span></span></summary>' + resources + '</details>');
html = html.replace('<div class="loading-indicator" id="loading-indicator">', '<div class="loading-indicator" id="loading-indicator" role="status">');
html = html.replace('<div class="modal-content">', '<div class="modal-content" role="dialog" aria-modal="true" aria-label="Consumos" tabindex="-1">');
html = html.replace('id="close-consumo-modal" class="modal-close"', 'id="close-consumo-modal" class="modal-close" aria-label="Cerrar consumos" type="button"');
html = html.replace('<div class="category-card">\n                    <h3>EPS</h3>', '<div class="category-card" id="show-eps-btn">\n                    <h3>EPS</h3>');
html = html.replace(/<script>[\s\S]*?<\/script>/g, '');
html = html.replace('<section class="notice-board"', '<div class="board-switch" role="group" aria-label="Vistas de trabajo"><button type="button" id="view-notices" aria-pressed="true" aria-controls="notices-panel">Tablón de comunicados</button><button type="button" id="view-tasks" aria-pressed="false" aria-controls="tasks-panel">✓ Repisa de tareas</button></div><section id="notices-panel" class="notice-board"');
html = html.replace('<details class="tools-drawer">', fs.readFileSync(path.join(root,'tasks.html'),'utf8') + '<details class="tools-drawer">');
html = html.replace(/<details class="tools-drawer">[\s\S]*?<\/details>/, "");
// Añadir atributos solo al HTML, antes de insertar el JavaScript.
html = html.replace(/target="_blank"/g, 'target="_blank" rel="noopener noreferrer"');
html = html.replace('</body>', '<script>\n' + fs.readFileSync(path.join(root, 'portal.js'), 'utf8') + '\n</script>\n<script>\n' + fs.readFileSync(path.join(root,'tasks.js'),'utf8') + '\n</script>\n</body>');
fs.writeFileSync(path.join(root, 'index.html'), html);
let gs = fs.readFileSync(path.join(root, 'codigo.original.gs'), 'utf8');
gs = gs.replace("createTemplateFromFile('Index')", "createTemplateFromFile('index')").replace(".setTitle('Gestión de Reembolsos')", ".setTitle('Ventas Corporativas | Flota La Macarena')\n    .addMetaTag('viewport', 'width=device-width, initial-scale=1')");
gs = gs.replace('var data = sheet.getDataRange().getValues();', 'var lastRow = sheet.getLastRow();\n    if (lastRow < 2) return [];\n    var data = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();');
gs = gs.replace("var correoActual = Session.getActiveUser().getEmail();", "if (!hojaConfig) throw new Error('No se encontró la hoja Configuración.');\n  var correoActual = Session.getActiveUser().getEmail();\n  if (!correoActual) throw new Error('No se pudo identificar tu correo. Abre la aplicación con tu cuenta corporativa.');");
gs = gs.replace('function guardarDatosReembolso(datos) {', `function guardarDatosReembolso(datos) {
  var identidad = verificarUsuarioActivo_();
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Datos de reembolso no válidos.');
  ['doc_usuario', 'nom_usuario', 'nro_orden', 'tipo_reembolso'].forEach(function(campo) {
    if (datos[campo] == null || !String(datos[campo]).trim()) throw new Error('Falta el campo: ' + campo);
  });
  var valor = Number(datos.valor);
  if (!isFinite(valor) || valor <= 0) throw new Error('El valor debe ser un número positivo.');
  datos = Object.assign({}, datos);
  datos.valor = valor;
  if (!identidad.usuarios.some(function(usuario) { return usuario.nombre === String(datos.usuario_gestiona || '').toUpperCase(); })) {
    throw new Error('El usuario que gestiona no corresponde a la sesión activa.');
  }
  Object.keys(datos).forEach(function(campo) {
    if (typeof datos[campo] === 'string') {
      if (datos[campo].length > 10000) throw new Error('El campo excede el tamaño permitido: ' + campo);
      // Evitar que texto recibido se interprete como una fórmula de Sheets.
      if (/^[=+@-]/.test(datos[campo].trimStart())) datos[campo] = "'" + datos[campo];
    }
  });`);
gs = gs.replace('function getDatosParaDashboard() {', 'function getDatosParaDashboard() {\n  verificarUsuarioActivo_();');
gs = gs.replaceAll("var hojaDatos = libro.getSheetByName('Datos');", "var hojaDatos = libro.getSheetByName('Datos');\n  if (!hojaDatos) throw new Error('No se encontró la hoja Datos.');");
gs += `\n// Las funciones terminadas en _ no se pueden invocar desde google.script.run.\nfunction verificarUsuarioActivo_() {\n  var identidad = getUsuariosPorCorreo();\n  if (!identidad.usuarios.length) throw new Error('Tu cuenta no tiene un usuario activo en Configuración.');\n  return identidad;\n}\n`;
fs.writeFileSync(path.join(root, 'codigo.gs'), gs);
