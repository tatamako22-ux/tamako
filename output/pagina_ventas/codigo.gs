// 1. Función para mostrar la página HTML
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Ventas Corporativas | Flota La Macarena')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 2. Función para obtener usuarios y autorizadores
function getUsuariosPorCorreo() {
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaConfig = libro.getSheetByName('Configuración');
  
  if (!hojaConfig) throw new Error('No se encontró la hoja Configuración.');
  var correoActual = Session.getActiveUser().getEmail();
  if (!correoActual) throw new Error('No se pudo identificar tu correo. Abre la aplicación con tu cuenta corporativa.'); 
  var datos = hojaConfig.getDataRange().getValues();
  
  var usuariosEncontrados = [];
  var autorizadoresEncontrados = [];
  
  for (var i = 1; i < datos.length; i++) {
    var correoEnHoja = datos[i][1] ? datos[i][1].toString().trim().toLowerCase() : "";
    var correoUsuario = correoActual.toString().trim().toLowerCase();
    var estadoEnHoja = datos[i][3] ? datos[i][3].toString().trim().toUpperCase() : "";
    
    if (correoEnHoja === correoUsuario && estadoEnHoja === "ACTIVO") { 
      usuariosEncontrados.push({
        nombre: datos[i][0] ? datos[i][0].toString().toUpperCase() : "",
        area: datos[i][5] ? datos[i][5].toString().toUpperCase() : "" 
      });
    }

    var nombreAutoriza = datos[i][8] ? datos[i][8].toString().trim().toUpperCase() : "";
    if (nombreAutoriza !== "") {
      autorizadoresEncontrados.push({
        nombre: nombreAutoriza,
        cargo: datos[i][9] ? datos[i][9].toString().trim().toUpperCase() : "",
        proceso: datos[i][10] ? datos[i][10].toString().trim().toUpperCase() : ""
      });
    }
  }
  
  return { correo: correoActual, usuarios: usuariosEncontrados, autorizadores: autorizadoresEncontrados };
}

// 3. Función para guardar los datos
function guardarDatosReembolso(datos) {
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
  });
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaDatos = libro.getSheetByName('Datos');
  if (!hojaDatos) throw new Error('No se encontró la hoja Datos.');
  
  hojaDatos.appendRow([
    new Date(),                                                              
    datos.tipo_doc ? datos.tipo_doc.toString().toUpperCase() : "",           
    datos.doc_usuario,                                                       
    datos.nom_usuario ? datos.nom_usuario.toString().toUpperCase() : "",     
    datos.area ? datos.area.toString().toUpperCase() : "",                   
    datos.nro_orden,                                                         
    datos.ruta ? datos.ruta.toString().toUpperCase() : "",                   
    datos.valor,                                                             
    datos.tipo_reembolso ? datos.tipo_reembolso.toString().toUpperCase() : "", 
    datos.proveedor ? datos.proveedor.toString().toUpperCase() : "",         
    datos.observacion ? datos.observacion.toString().toUpperCase() : "",     
    datos.usuario_gestiona ? datos.usuario_gestiona.toString().toUpperCase() : "", 
    datos.quien_autoriza ? datos.quien_autoriza.toString().toUpperCase() : "",  
    datos.cargo_autoriza ? datos.cargo_autoriza.toString().toUpperCase() : "",  
    datos.proceso_autoriza ? datos.proceso_autoriza.toString().toUpperCase() : "" 
  ]);
  return "Éxito";
}
// 4. Obtener datos para el Dashboard
function getDatosParaDashboard() {
  verificarUsuarioActivo_();
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaDatos = libro.getSheetByName('Datos');
  if (!hojaDatos) throw new Error('No se encontró la hoja Datos.');
  
  // Extraemos los datos y los empaquetamos como JSON (ESTO EVITA EL ERROR DE LAS FECHAS)
  var valores = hojaDatos.getDataRange().getValues();
  return JSON.stringify(valores); 
}
// 5. Función para obtener los comunicados del Tablón
function getMensajes() {
  // ID del Excel de comunicados que me compartiste
  var sheetId = '1JJ14voc_ck41FNpY5DDyYFqdBuvsENBVa8wS1BTNZSA';
  var sheetName = 'comunicado'; 
  
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("No se encontró la hoja 'comunicado'");
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var data = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
    var mensajes = [];
    
    // Iteramos desde 1 para omitir la fila de encabezados
    for (var i = 1; i < data.length; i++) {
      var titulo = data[i][0] ? data[i][0].toString() : "";
      var descripcion = data[i][1] ? data[i][1].toString() : "";
      
      if (titulo !== "" || descripcion !== "") {
        mensajes.push({ title: titulo, content: descripcion });
      }
    }
    
    return mensajes; 
  } catch (error) {
    console.error("Error en getMensajes: " + error);
    throw error;
  }
}
// Las funciones terminadas en _ no se pueden invocar desde google.script.run.
function verificarUsuarioActivo_() {
  var identidad = getUsuariosPorCorreo();
  if (!identidad.usuarios.length) throw new Error('Tu cuenta no tiene un usuario activo en Configuración.');
  return identidad;
}
