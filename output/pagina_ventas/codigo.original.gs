// 1. Función para mostrar la página HTML
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gestión de Reembolsos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 2. Función para obtener usuarios y autorizadores
function getUsuariosPorCorreo() {
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaConfig = libro.getSheetByName('Configuración');
  
  var correoActual = Session.getActiveUser().getEmail(); 
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
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaDatos = libro.getSheetByName('Datos');
  
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
  var idHoja = '13d6chof6sicfRq65xMoPgOmvl6Ym5fRFF2ARCMShzIY'; 
  var libro = SpreadsheetApp.openById(idHoja);
  var hojaDatos = libro.getSheetByName('Datos');
  
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
    
    var data = sheet.getDataRange().getValues();
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