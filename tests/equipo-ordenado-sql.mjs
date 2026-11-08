import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '../tmp/performance-sql/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const U='00000000-0000-0000-0000-000000000001', V='00000000-0000-0000-0000-000000000002';
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002';
const E='20000000-0000-0000-0000-000000000001', F='20000000-0000-0000-0000-000000000002';
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
let checks=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const fails=async(sql,args,pattern)=>{await assert.rejects(q(sql,args),pattern);checks++;};
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table tiendas(id uuid primary key default gen_random_uuid(),user_id uuid,nombre text,slug text unique,propietario text,email text,telefono text,direccion text,cantidad_puestos int,tablon_tipo text,tablon_activo boolean,tablon_titulo text,tablon_mensaje text);
 create table profesionales(id_barbero uuid primary key default gen_random_uuid(),id_tienda uuid,nombre_empleado text,puesto_asignado int,modo_agenda text,horario_inicio time,horario_fin time,horario_semanal jsonb);
 create table perfiles(id uuid primary key default gen_random_uuid(),user_id uuid,tienda_id uuid,id_profesional uuid references profesionales(id_barbero),nombre text,email text,rol text,activo boolean default true,permisos jsonb default '{}');
 create table citas(id uuid primary key default gen_random_uuid(),id_tienda uuid,id_barbero uuid references profesionales(id_barbero),nota text);
 insert into auth.users values('${U}'),('${V}');
 grant usage on schema public,auth to authenticated,service_role;`);
 for(const name of ['superadmin_suscripciones.sql','superadmin_suscripciones_v2.sql','planes_capacidades.sql','planes_comerciales_20261027.sql','planes_operacion_20261027.sql','usuarios_agenda_propietario_20261108.sql','equipo_ordenado_20261108.sql']){
 await db.exec(fs.readFileSync('supabase/'+name,'utf8').replace('create extension if not exists pgcrypto;',''));
 }
 await q('insert into tiendas(id,user_id,nombre,slug) values($1,$2,\'A\',\'a\'),($3,$4,\'B\',\'b\')',[A,U,B,V]);
 const before=await q('select * from profesionales');
 await db.exec(fs.readFileSync('supabase/equipo_ordenado_20261108.sql','utf8'));
 check(await q('select * from profesionales'),before);
 const alta=(actor,shop,user,id=null)=>q('select crear_integrante_tamaku($1,$2,$3,$4) p',[actor,shop,user,{nombre:'Empleado',email:'empleado@example.co',rol:'EMPLEADO',id_profesional:id,permisos:{agenda_ver:true}}]);
 await db.exec('set role authenticated');
 await fails('select crear_integrante_tamaku($1,$2,$3,$4)',[U,A,E,{}],/permission denied/);
 await db.exec('reset role');
 await assert.rejects(alta(U,B,E),/propietario/);checks++;
 const employee=(await alta(U,A,E))[0].p;
 const alien=(await alta(V,B,F))[0].p;
 check(employee.tienda_id,A);
 await assert.rejects(alta(U,A,F,alien.id_profesional),/no pertenece/);checks++;
 await assert.rejects(alta(U,A,F,employee.id_profesional),/ya tiene/);checks++;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[U]);
 await q('insert into citas(id_tienda,id_barbero,nota) values($1,$2,\'Historia\')',[A,employee.id_profesional]);
 const alienBefore=await q('select * from perfiles where tienda_id=$1',[B]);
 await db.exec('set role authenticated');
 await fails('select retirar_integrante_tamaku($1,$2)',[B,alien.id_profesional],/propietario/);
 await q('select retirar_integrante_tamaku($1,$2)',[A,employee.id_profesional]);
 await q('select retirar_integrante_tamaku($1,$2)',[A,employee.id_profesional]);
 await db.exec('reset role');
 check(await q('select * from perfiles where tienda_id=$1',[B]),alienBefore);
 check((await q('select activo from perfiles where id=$1',[employee.id]))[0].activo,false);
 check((await q('select count(*)::int n from citas'))[0].n,1);
 check((await q('select count(*)::int n from profesionales'))[0].n,2);
 await fails('insert into citas(id_tienda,id_barbero) values($1,$2)',[A,employee.id_profesional],/retirado/);
 await q("update citas set nota='Historia conservada'");
 await fails('update perfiles set activo=true where id=$1',[employee.id],/retirado/);
 await assert.rejects(alta(U,A,F,employee.id_profesional),/ya tiene|retirado/);checks++;
 // Un error de cupo revierte tambien el profesional recien creado.
 await q("update tamaku_suscripciones set estado='ACTIVA',plan_id=(select id from tamaku_planes where codigo='BASICO') where id_tienda=$1",[A]);
 const count=(await q('select count(*)::int n from profesionales'))[0].n;
 await assert.rejects(alta(U,A,F),/permite 1/);checks++;
 check((await q('select count(*)::int n from profesionales'))[0].n,count);
 await q('select configurar_mi_agenda_tamaku($1,true)',[A]);
 const ownerPro=(await q('select id_barbero from profesionales where propietario_user_id=$1',[U]))[0].id_barbero;
 await fails('select retirar_integrante_tamaku($1,$2)',[A,ownerPro],/propietario/);
 console.log(checks+' comprobaciones: aislamiento, archivo, historial, permisos, cupos y alta atomica.');
} catch(error) {console.error(error.message, error.position, error.query?.slice(Math.max(0, Number(error.position)-90), Number(error.position)+90));process.exitCode=1;} finally {await db.close();}

