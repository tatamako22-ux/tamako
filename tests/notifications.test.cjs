const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {parseHTML}=require('../tmp/ui-tests/node_modules/linkedom');
const acorn=require('../tmp/ui-tests/node_modules/acorn');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

function setup(){
  const dom=parseHTML('<html><head></head><body><main><button id="origin">Acción</button></main></body></html>');
  const document=dom.document;
  const window={HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Event:dom.window.Event};
  let active=document.getElementById('origin');
  Object.defineProperty(document,'activeElement',{get:()=>active});
  window.HTMLElement.prototype.focus=function(){active=this;};
  window.HTMLInputElement.prototype.select=function(){};
  const timers=new Map();let id=0;
  const context=vm.createContext({window,document,console,Promise,WeakSet,Date,
    requestAnimationFrame:fn=>fn(),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
  vm.runInContext(fs.readFileSync('assets/js/core/notifications.js','utf8'),context);
  return {window,document,ui:window.TamakuUI,timers,
    submit:()=>document.querySelector('.tamaku-confirm-card').dispatchEvent(new window.Event('submit',{cancelable:true,bubbles:true})),
    key:(key,extra={})=>{const event=new window.Event('keydown',{cancelable:true,bubbles:true});Object.assign(event,{key,...extra});document.activeElement.dispatchEvent(event);return event;}};
}
test('cancelar y Escape no autorizan acciones, restauran foco y fondo',async()=>{
  const s=setup(); let actions=0;
  const flow=(async()=>{if(await s.ui.confirm('¿Eliminar cliente?'))actions++;})();
  await settle();
  assert.equal(s.document.activeElement.className,'tamaku-confirm-cancel');
  assert.equal(s.document.querySelector('main').inert,true);
  s.document.querySelector('.tamaku-confirm-cancel').click();await flow;
  assert.equal(actions,0);assert.equal(s.document.activeElement.id,'origin');
  assert.notEqual(s.document.querySelector('main').inert,true);
  const second=s.ui.confirm('¿Pagar?');await settle();s.key('Escape');assert.equal(await second,false);
});
test('confirmar autoriza una sola vez y los dialogos concurrentes se encolan',async()=>{
  const s=setup();const first=s.ui.confirm('Primera'), second=s.ui.confirm('Segunda');await settle();
  assert.equal(s.document.querySelectorAll('[role="dialog"]').length,1);
  assert.equal(s.document.querySelector('.tamaku-confirm-card p').textContent,'Primera');
  s.submit();assert.equal(await first,true);await settle();
  assert.equal(s.document.querySelector('.tamaku-confirm-card p').textContent,'Segunda');
  s.key('Escape');assert.equal(await second,false);
});
test('prompt valida numeros dentro de la pagina y distingue cancelar de vacio',async()=>{
  const s=setup();const result=s.ui.prompt({mensaje:'Días',tipo:'number',min:1,paso:1,requerido:true,valorInicial:'7'});await settle();
  const input=s.document.querySelector('.tamaku-confirm-field input');
  input.value='-2';s.submit();assert.equal(input.getAttribute('aria-invalid'),'true');
  assert.equal(s.document.querySelector('.tamaku-confirm-error').hidden,false);
  input.value='2.5';s.submit();assert.equal(input.getAttribute('aria-invalid'),'true');
  input.value='10';s.submit();assert.equal(await result,'10');
  const cancelled=s.ui.prompt('Motivo','texto');await settle();s.key('Escape');assert.equal(await cancelled,null);
  const empty=s.ui.prompt('Opcional');await settle();s.submit();assert.equal(await empty,'');
});
test('Enter no acepta el dialogo por un manejador global; Tab permanece dentro',async()=>{
  const s=setup();let done=false;const result=s.ui.confirm('¿Eliminar?').then(v=>{done=true;return v;});await settle();
  s.key('Enter');await settle();assert.equal(done,false);
  s.key('Tab',{shiftKey:true});assert.equal(s.document.activeElement.classList.contains('tamaku-confirm-accept'),true);
  s.key('Tab');assert.equal(s.document.activeElement.classList.contains('tamaku-confirm-cancel'),true);
  s.key('Escape');assert.equal(await result,false);
});
test('avisos escapan texto y titulos, no dependen de iconos externos, limite de cuatro',()=>{
  const s=setup();s.ui.toast('<img src=x onerror=bad()>','error',{titulo:'<b>Título</b>',duracion:0});
  assert.equal(s.document.querySelector('.tamaku-toast img'),null);
  assert.equal(s.document.querySelector('.tamaku-toast strong').textContent,'<b>Título</b>');
  assert.equal(s.document.querySelector('.tamaku-toast').getAttribute('role'),'alert');
  for(let i=0;i<6;i++)s.ui.success(String(i));
  assert.equal(s.document.querySelectorAll('.tamaku-toast').length,4);
  s.document.querySelector('.tamaku-toast-close').click();assert.equal(s.document.querySelectorAll('.tamaku-toast').length,3);
});
test('validacion nativa se presenta como aviso propio sin quitar restricciones',()=>{
  const s=setup();const input=s.document.createElement('input');input.required=true;input.setAttribute('placeholder','Correo');
  s.document.body.append(input);const event=new s.window.Event('invalid',{cancelable:true,bubbles:true});input.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(input.required,true);assert.equal(input.getAttribute('aria-invalid'),'true');
  assert.ok(s.document.querySelector('.tamaku-toast-warning'));
});
test('todo el aplicativo analiza y no contiene llamadas alert/confirm/prompt nativas',()=>{
  const files=['index.html'];
  function collect(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(fs.statSync(p).isDirectory())collect(p);else if(/\.(html|js)$/.test(p))files.push(p);}}
  collect('pages');collect('assets/js');
  for(const file of files){
    const text=fs.readFileSync(file,'utf8');
    const scripts=file.endsWith('.html')?[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('ld+json')).map(m=>m[2]):[text];
    if(file.endsWith('.html')){assert.ok(text.includes('notifications.js?v=2'),file);assert.ok(text.includes('notifications.css?v=2'),file);}
    for(const src of scripts){
      const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'});
      function walk(node,parents=[]){if(!node||typeof node!=='object')return;
        if(node.type==='CallExpression'){
          const c=node.callee;const name=c.type==='Identifier'?c.name:c.type==='MemberExpression'&&c.object.name==='window'?c.property.name:null;
          assert.ok(!['alert','confirm','prompt'].includes(name),file+' native '+name);
          if(c.type==='MemberExpression'&&['confirm','prompt'].includes(c.property?.name)&&c.object?.property?.name==='TamakuUI')assert.ok(parents.some(p=>p.type==='AwaitExpression'),file+' missing await');
        }
        for(const v of Object.values(node))if(Array.isArray(v))v.forEach(x=>walk(x,[...parents,node]));else if(v&&typeof v==='object')walk(v,[...parents,node]);
      }
      walk(ast);
    }
  }
});
