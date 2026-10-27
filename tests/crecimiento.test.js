import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from '../tmp/ui-tests/node_modules/linkedom/esm/index.js';
import { nombrePlan, permiteFuncion } from '../assets/js/core/planes.js';
import { readAllPages } from '../assets/js/core/read-pages.js';

async function pantalla(funciones,rows=[]) {
  const { document, window }=parseHTML(fs.readFileSync('pages/crecimiento.html','utf8'));
  const form=document.getElementById('growthForm'),dialog=document.getElementById('growthDialog');
  const namedItem=name=>form.querySelector(`[name="${name}"]`);
  Object.defineProperty(form,'elements',{value:{namedItem}});
  form.reset=()=>form.querySelectorAll('input,textarea,select').forEach(c=>{if(c.tagName!=='SELECT')c.value='';c.checked=false;});
  Object.defineProperty(namedItem('etapa'),'value',{writable:true,value:'PENDIENTE'});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');
  const llamadas=[],guardados=[];
  const contexto={id:'tienda-a',nombre:'Mi negocio',sesion:{es_propietario:true},suscripcion:{plan_efectivo:'PREMIUM',funcionalidades:funciones}};
  window.tamakuContextReady=Promise.resolve(contexto);window.TamakuUI={notify() {}};
  const supabase={
    rpc:async(nombre,args)=>{llamadas.push(nombre);return {data:nombre==='listar_sedes_tamaku'?[{id:'sede-a',nombre:'Norte',principal:true}]:null,error:null};},
    from(tabla){llamadas.push(tabla);let action='read',datos;
      const chain={select(){return chain;},eq(){return chain;},order(){return chain;},
        range:async(start)=>({data:start===0?rows:[],error:null}),
        insert(payload){action='insert';datos=payload;return chain;},update(payload){action='update';datos=payload;return chain;},
        single:async()=>{guardados.push({action,datos});return {data:{id:'guardado'},error:null};}};
      return chain;
    },
  };
  const source=fs.readFileSync('assets/js/crecimiento.js','utf8').replace(/^import .*;\r?\n/gm,'');
  const entorno=vm.createContext({document,window,supabase,nombrePlan,permiteFuncion,readAllPages,cambiarSede:async()=>{},
    location:{hash:''},history:{replaceState(){}},console,Intl,URL,encodeURIComponent});
  vm.runInContext(source,entorno);
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};await flush();
  return {document,window,form,namedItem,dialog,llamadas,guardados,flush};
}

test('Plata no consulta tablas de crecimiento ni muestra botones de módulos',async()=>{
  const p=await pantalla({marketing:false,crm_avanzado:false,multisede:false});
  assert.equal(p.llamadas.length,0);
  assert.ok([...p.document.querySelectorAll('[data-modulo]')].every(b=>b.hidden));
  assert.equal(p.document.getElementById('growthContent').hidden,true);
});

test('Zafiro muestra marketing y oportunidades; oculta CRM avanzado y sedes',async()=>{
  const p=await pantalla({marketing:true,crm_avanzado:false,multisede:false});
  assert.equal(p.document.querySelector('[data-modulo="CAMPANA"]').hidden,false);
  assert.equal(p.document.querySelector('[data-modulo="OPORTUNIDAD"]').hidden,false);
  assert.equal(p.document.querySelector('[data-modulo="TAREA"]').hidden,true);
  assert.equal(p.document.querySelector('[data-modulo="SEDE"]').hidden,true);
});

test('el formulario guarda en la tienda actual y conserva el consentimiento explícito',async()=>{
  const p=await pantalla({marketing:true});
  p.document.getElementById('growthNew').click();
  p.namedItem('titulo').value='Campaña de noviembre';p.namedItem('telefono').value='573001234567';
  p.namedItem('etapa').value='PENDIENTE';p.namedItem('valor').value='150000';
  p.namedItem('consentimiento').checked=true;
  p.form.dispatchEvent(new p.window.Event('submit',{cancelable:true}));await p.flush();
  assert.equal(p.guardados.length,1);
  assert.equal(p.guardados[0].datos.id_tienda,'tienda-a');
  assert.equal(p.guardados[0].datos.tipo,'CAMPANA');
  assert.equal(p.guardados[0].datos.consentimiento,true);
  assert.equal(p.guardados[0].datos.valor,150000);
  assert.equal(p.dialog.hasAttribute('open'),false);
});

test('escapa notas y no ofrece contacto WhatsApp sin consentimiento',async()=>{
  const p=await pantalla({marketing:true},[{id:'registro-a',titulo:'<img src=x onerror=evil()>',notas:'<script>evil()</script>',etapa:'PENDIENTE',valor:0,telefono:'573001234567',consentimiento:false}]);
  const list=p.document.getElementById('growthList');
  assert.equal(list.querySelector('script'),null);assert.equal(list.querySelector('img'),null);
  assert.equal(list.querySelector('a[href*="wa.me"]'),null);
});

test('Diamante permite consultar sedes sin mezclar sus datos comerciales',async()=>{
  const p=await pantalla({marketing:true,crm_avanzado:true,multisede:true});
  p.document.querySelector('[data-modulo="SEDE"]').click();await p.flush();
  assert.ok(p.llamadas.includes('listar_sedes_tamaku'));
  assert.ok(p.document.querySelector('[data-sede="sede-a"]'));
  p.document.getElementById('growthNew').click();
  assert.equal(p.namedItem('telefono').disabled,true);
  assert.equal(p.namedItem('telefono_sede').disabled,false);
});
