import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/create-user.js';
test('alta usa una transaccion y revierte Auth si falla el cupo; tienda ajena no crea cuentas',async()=>{
 const fetchOriginal=globalThis.fetch,env={...process.env};
 Object.assign(process.env,{SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'secret'});
 try{for(const caso of ['ok','cupo','ajena']){
 const calls=[];
 globalThis.fetch=async(url,opts={})=>{
 calls.push({url,opts});let data,ok=true;
 if(url.endsWith('/auth/v1/user'))data={id:'owner'};
 else if(url.includes('/tiendas?'))data=caso==='ajena'?[]:[{id:'shop'}];
 else if(url.endsWith('/auth/v1/admin/users'))data={id:'new-user',email:'staff@test.co'};
 else if(url.includes('/rpc/crear_integrante_tamaku')){ok=caso!=='cupo';data=ok?{id:'profile',id_profesional:'pro'}:{message:'El plan permite 1'};}
 else if(opts.method==='DELETE') data={};else throw Error('Ruta inesperada '+url);
 return {ok,status:ok?200:400,json:async()=>data};
 };
 const res={status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 await handler({method:'POST',headers:{authorization:'Bearer token'},body:{tienda_id:'shop',nombre:'Equipo',email:'staff@test.co',password:'password123',rol:'EMPLEADO'}},res);
 assert.equal(res.code,{ok:201,cupo:400,ajena:403}[caso]);
 assert.equal(calls.filter(c=>c.opts.method==='DELETE').length,caso==='cupo'?1:0);
 if(caso==='ok'){assert.equal(res.data.perfil.id_profesional,'pro');const body=JSON.parse(calls.find(c=>c.url.includes('/rpc/')).opts.body);assert.equal(body.p_actor,'owner');assert.equal(body.p_tienda,'shop');}
 if(caso==='ajena')assert.equal(calls.length,2);
 }}finally{globalThis.fetch=fetchOriginal;process.env=env;}
});
