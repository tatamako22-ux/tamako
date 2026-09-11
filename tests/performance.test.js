import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import nodePath from 'node:path';
import { createLatestLoader } from '../assets/js/core/latest-load.js';
import { readAllPages, isMissingRpc } from '../assets/js/core/read-pages.js';
import { indexarCitas, citasDelCliente } from '../assets/js/services/client-identity.js';

const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise, resolve, reject}; };

test('agenda: descarta el dia anterior y procesa solo la ultima solicitud pendiente', async () => {
  const first=defer(), seen=[], applied=[];
  const loader=createLatestLoader(async input => { seen.push(input); if(input==='lunes') await first.promise; return input; }, value => applied.push(value));
  const done=loader.request('lunes'); loader.request('martes'); loader.request('miercoles');
  first.resolve(); await done;
  assert.deepEqual(seen,['lunes','miercoles']); assert.deepEqual(applied,['miercoles']);
});
test('un evento durante una carga provoca una segunda lectura; no desaparece', async () => {
  const first=defer(); let reads=0; const values=[];
  const loader=createLatestLoader(async () => { const n=++reads; if(n===1) await first.promise; return n; }, n=>values.push(n));
  const done=loader.request(); loader.request(); first.resolve(); await done;
  assert.equal(reads,2); assert.deepEqual(values,[2]);
});
test('errores antiguos no reemplazan la pantalla; dispose impide aplicar datos', async () => {
  const first=defer(), errors=[], values=[];
  const loader=createLatestLoader(async input => { if(input===1) await first.promise; return input; }, n=>values.push(n), e=>errors.push(e));
  const done=loader.request(1); loader.request(2); first.reject(Error('old')); await done;
  assert.deepEqual(errors,[]); assert.deepEqual(values,[2]);
  const wait=defer(); const stopped=createLatestLoader(()=>wait.promise,n=>values.push(n));
  const pending=stopped.request(); stopped.dispose(); wait.resolve(3); await pending;
  assert.deepEqual(values,[2]);
});
test('la paginacion no pierde filas si la API devuelve menos del tamano solicitado', async () => {
  const source=Array.from({length:1207},(_,id)=>({id})); let calls=0;
  const rows=await readAllPages(()=>({range:async (from,to)=>{calls++;return {data:source.slice(from, Math.min(to+1,from+137)),error:null};}}));
  assert.deepEqual(rows,source); assert.equal(calls,10);
});
test('un fallo en una pagina no devuelve un total parcial como si fuera completo', async () => {
  await assert.rejects(readAllPages(()=>({range:async from=>from?{error:Error('network')}:{data:[{id:1}]}})),/network/);
  assert.equal(isMissingRpc({code:'PGRST202'}),true);
  assert.equal(isMissingRpc({code:'42501'}),false);
});
test('indice de clientes conserva coincidencias directas, sin duplicados ni coincidencias transitivas',()=>{
  const rows=[
    {id_cita:1,user_id:'a',telefono_cliente:'3001234567',email_cliente:'one@test.co'},
    {id_cita:2,user_id:'a',telefono_cliente:'+57 3001234567'},
    {id_cita:3,email_cliente:' ONE@test.co '},
    {id_cita:4,telefono_cliente:'0000000000'},
    {id_cita:5,user_id:'other',email_cliente:'different@test.co'},
  ];
  assert.deepEqual(citasDelCliente(indexarCitas(rows),rows[0]).map(r=>r.id_cita).sort(),[2,3]);
  assert.deepEqual(citasDelCliente(indexarCitas(rows),rows[3]),[]);
});
test('panel: respaldo de 60 s conectado, 30 s desconectado y eventos inmediatos agrupados', async()=>{
  let now=0, reads=0, interval, status, event, delayed;
  const document={visibilityState:'visible',getElementById:()=>null,addEventListener:()=>{}};
  const context=vm.createContext({console,Intl,Date:class extends Date { static now(){return now;} },document,
    window:{addEventListener:()=>{}},createLatestLoader,
    obtenerDatosDashboard:async()=>{reads++;return {};},
    suscribirDashboard:(id,onChange,onStatus)=>{event=onChange;status=onStatus;return ()=>{};},
    setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{},setTimeout:fn=>{delayed=fn;return 1;},clearTimeout:()=>{},
  });
  const src=fs.readFileSync('assets/js/dashboard/dashboard.overview.js','utf8')
    .replace(/import\s+[\s\S]*?\sfrom\s*["'][^"']+["'];/g,'').replace('export function initOverview','function initOverview');
  vm.runInContext(src+'\nrenderDashboard = () => {}; initOverview({id:"test"});',context);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  await settle(); assert.equal(reads,1); status('SUBSCRIBED');
  now=15000; interval(); await settle(); assert.equal(reads,1);
  now=60000; interval(); await settle(); assert.equal(reads,2);
  event(); delayed(); await settle(); assert.equal(reads,3);
  status('CHANNEL_ERROR'); now=90000; interval(); await settle(); assert.equal(reads,4);
  document.visibilityState='hidden'; now=180000; interval(); await settle(); assert.equal(reads,4);
});
test('PWA no precarga pantallas internas y no intercepta escrituras ni respuestas API',async()=>{
  const events={}, cached=[], tasks=[]; let response;
  const context=vm.createContext({URL,Response,
    self:{location:{origin:'https://www.tamaku.co'},addEventListener:(name,cb)=>events[name]=cb,skipWaiting:()=>{},clients:{claim:()=>{}}},
    caches:{open:async()=>({addAll:async urls=>cached.push(...urls),put:async()=>{}}),match:async()=>undefined},
    fetch:async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}}),
  });
  vm.runInContext(fs.readFileSync('sw.js','utf8'),context);
  events.install({waitUntil:p=>tasks.push(p)}); await Promise.all(tasks);
  assert.equal(cached.length,5); assert.ok(!cached.some(url=>url.includes('/pages/')));
  for(const [url,method] of [['https://www.tamaku.co/api/send-email','POST'],['https://example.com/data','GET'],['https://www.tamaku.co/pages/reserva.html?id=cliente','GET']]) {
    events.fetch({request:{url,method},respondWith:()=>assert.fail('should not intercept')});
  }
  events.fetch({request:{url:'https://www.tamaku.co/pages/agenda.html',method:'GET'},respondWith:p=>response=p,waitUntil:p=>tasks.push(p)});
  assert.equal((await response).status,200); await Promise.all(tasks);
});
test('HTML modificado: JavaScript inline valido, sin perder archivos locales referenciados', async()=>{
  for(const path of ['index.html','pages/clientes.html','pages/reserva.html','pages/agenda.html','pages/dashboard.html','pages/facturacion.html']) {
    const html=fs.readFileSync(path,'utf8');
    for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
      const value=match[1].split('?')[0];
      if (/^(https?:|data:|#)/.test(value) || value.includes('${')) continue;
      const resolved=value.startsWith('/') ? nodePath.resolve('.'+value) : nodePath.resolve(nodePath.dirname(path),value);
      assert.ok(fs.existsSync(resolved), `${path}: ${value}`);
    }
    for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if(m[1].includes('ld+json')) JSON.parse(m[2]);
      else if(!m[1].includes('src=')) {
        // Async wrapper permite top-level await de los modulos HTML.
        new vm.Script('(async()=>{'+m[2].replace(/import\s+[\s\S]*?\sfrom\s*["'][^"']+["'];/g,'')+'})');
      }
    }
  }
});
