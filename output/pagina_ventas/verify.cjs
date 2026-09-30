const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const read = name => fs.readFileSync(path.join(__dirname,name),'utf8');
const original = read('index.original.html'), html = read('index.html');
const urls = s => [...s.matchAll(/href="(https?:[^\"]+)"/g)].map(m=>m[1]).sort();
assert.deepEqual(urls(html),urls(original),'Debe conservar cada destino original');
const ids = [...html.matchAll(/\bid="([^\"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'IDs únicos');
for(const match of read('portal.js').matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]),'Elemento existente: '+match[1]);
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
new vm.Script(read('codigo.gs'));
let activeEmail = 'persona@empresa.test', appended = null, configPresent = true;
let rows = [['Título','Descripción'],['Aviso','Contenido'],['','']];
const context = {
 console,
 Session:{getActiveUser:()=>({getEmail:()=>activeEmail})},
 HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createTemplateFromFile:name=>({evaluate:()=>({name,setTitle(title){this.title=title;return this;},addMetaTag(){return this;},setXFrameOptionsMode(){return this;}})})},
 SpreadsheetApp:{openById:()=>({getSheetByName:name=>{
   if(name==='Configuración') return configPresent ? {getDataRange:()=>({getValues:()=>[['Nombre','Correo'],['PERSONA','persona@empresa.test','','ACTIVO','','VENTAS']]})} : null;
   if(name==='Datos') return {appendRow:r=>appended=r,getDataRange:()=>({getValues:()=>[['Cabecera'],['Valor']]})};
   if(name==='comunicado') return {getLastRow:()=>rows.length,getRange:()=>({getDisplayValues:()=>rows})};
 }})}
};
vm.createContext(context);vm.runInContext(read('codigo.gs'),context);
assert.equal(context.doGet().name,'index');
assert.match(context.doGet().title,/Ventas Corporativas/);
assert.equal(context.getMensajes().length,1);
rows = [['Título','Descripción']]; assert.equal(context.getMensajes().length,0);
const valid = {doc_usuario:'123',nom_usuario:'Cliente',nro_orden:'1',tipo_reembolso:'Parcial',valor:1000,usuario_gestiona:'PERSONA',observacion:'=IMPORTXML("x")'};
assert.equal(context.guardarDatosReembolso(valid),'Éxito');
assert.equal(appended[7],1000); assert.ok(appended[10].startsWith("'="));
assert.throws(()=>context.guardarDatosReembolso({...valid,valor:-1}),/positivo/);
assert.throws(()=>context.guardarDatosReembolso({...valid,usuario_gestiona:'OTRO'}),/sesión/);
activeEmail=''; assert.throws(()=>context.getDatosParaDashboard(),/identificar/);
activeEmail='sinpermiso@empresa.test'; assert.throws(()=>context.guardarDatosReembolso(valid),/activo/);
activeEmail='persona@empresa.test';configPresent=false;assert.throws(()=>context.getUsuariosPorCorreo(),/Configuración/);
console.log('PASS: sintaxis de cliente y servidor, IDs, '+urls(html).length+' URLs conservadas, carga y vacío de comunicados, identidad, campos y valor de reembolsos, protección contra fórmulas.');
