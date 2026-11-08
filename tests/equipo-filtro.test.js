import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('filtra retirados solo para la tienda consultada; conserva registros anteriores sin archivo',async()=>{
 const source=fs.readFileSync('assets/js/core/equipo.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function');
 const shops=[];
 const ctx={supabase:{from:()=>({select(){return this;},eq(k,v){shops.push(v);return Promise.resolve({data:v==='A'?[{id_profesional:'pro'}]:[]});}})}};
 vm.runInNewContext(source,ctx);
 const records=[{id_barbero:'pro'},{id_barbero:'otro'}];
 assert.equal((await ctx.profesionalesVigentes(records,'A')).length,1);
 assert.equal((await ctx.profesionalesVigentes(records,'B')).length,2);
 assert.deepEqual(shops,['A','B']);
});
