import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('oculta solo el profesional elegido al no atender y consulta la tienda actual',async()=>{
 const source=fs.readFileSync('assets/js/core/agenda-propietario.js','utf8').replace(/^\uFEFF/,'').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function');
 for(const visible of [true,false]){
 const filtros=[];
 const context={profesionalesVigentes:async p=>p,supabase:{from:()=>({select(){return this;},eq(k,v){filtros.push([k,v]);return this;},async maybeSingle(){return {data:{id_profesional:'owner-pro',visible}};}})}};
 vm.runInNewContext(source,context);
 const result=await context.filtrarAgendaPropietario([{id_barbero:'owner-pro'},{id_barbero:'staff-pro'}],'shop');
 assert.equal(result.length,visible?2:1);
 assert.deepEqual(filtros,[['id_tienda','shop']]);
 }
});
