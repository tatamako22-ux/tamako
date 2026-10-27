import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function sesion({contextoNuevo,estado,pagina='dashboard.html',seleccionada}={}) {
  const almacen=new Map(),temporal=new Map(seleccionada?[['tamaku_sede_activa',seleccionada]]:[]),redirects=[],rpcs=[];
  const contexto={id_tienda:'principal',es_propietario:true,rol:'admin'};
  const entorno={URL,console:{error(){}},
    localStorage:{getItem:k=>almacen.get(k)||null,setItem:(k,v)=>almacen.set(k,v),removeItem:k=>almacen.delete(k)},
    sessionStorage:{getItem:k=>temporal.get(k)||null,setItem:(k,v)=>temporal.set(k,v),removeItem:k=>temporal.delete(k)},
    window:{location:{pathname:`/pages/${pagina}`,replace:url=>redirects.push(url),assign:url=>redirects.push(url)}},
    supabase:{auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},
      rpc:async(nombre,args)=>{rpcs.push(nombre);if(nombre==='contexto_sede_tamaku')return contextoNuevo??{data:null,error:{code:'PGRST202',message:'Could not find function'}};
        if(nombre==='obtener_contexto_usuario')return {data:[contexto],error:null};
        return {data:[estado??{acceso:true,estado:'ACTIVA',funcionalidades:{dashboard:true}}],error:null};},
      from:()=>({select(){return this;},eq(clave,id){if(clave==='id')this.id=id;return this;},async single(){return {data:{id:this.id,nombre:'Negocio'},error:null};}}),
    },
  };
  let source=fs.readFileSync('assets/js/core/session.js','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','"https://www.tamaku.co/assets/js/core/session.js"');
  source=source.replace(/export /g,'');
  vm.runInNewContext(source+'\nglobalThis.requireTiendaInfo=requireTiendaInfo;',entorno);
  return {entorno,temporal,redirects,rpcs};
}

test('la sesión antigua sigue funcionando si falta la migración de sedes',async()=>{
  const s=sesion();const tienda=await s.entorno.requireTiendaInfo();
  assert.equal(tienda.id,'principal');assert.equal(tienda.sesion.es_propietario,true);
  assert.deepEqual(s.rpcs,['contexto_sede_tamaku','obtener_contexto_usuario','obtener_estado_suscripcion']);
});
test('una sede ajena en el almacenamiento no sustituye el contexto autorizado',async()=>{
  const s=sesion({seleccionada:'ajena',contextoNuevo:{data:null,error:null}});
  assert.equal((await s.entorno.requireTiendaInfo()).id,'principal');
  assert.equal(s.temporal.has('tamaku_sede_activa'),false);
});
test('al perder Multi-Sede se vuelve a la principal sin cerrar sesión ni perder datos',async()=>{
  const s=sesion({seleccionada:'sede',contextoNuevo:{data:{id_tienda:'sede',tienda_principal:'principal',es_propietario:true},error:null},estado:{acceso:false,estado:'ACTIVA'}});
  assert.equal(await s.entorno.requireTiendaInfo(),null);
  assert.equal(s.temporal.get('tamaku_sede_activa'),'principal');
  assert.match(s.redirects[0],/pages\/dashboard.html$/);
});
