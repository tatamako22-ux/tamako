// Base efímera PostgreSQL/PGlite: nunca se conecta a producción.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '../tmp/performance-sql/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const U='00000000-0000-0000-0000-000000000001', V='00000000-0000-0000-0000-000000000002';
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002';
let comprobaciones=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);comprobaciones++;};
const q=async(sql,params=[])=> (await db.query(sql,params)).rows;
async function falla(sql,params=[],patron){await assert.rejects(q(sql,params),patron);comprobaciones++;}
async function sesion(id,rol='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${rol};`);}
try {
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table tiendas(id uuid primary key default gen_random_uuid(),user_id uuid,nombre text,slug text unique,propietario text,email text,telefono text,direccion text,cantidad_puestos integer,
      tablon_tipo text default 'aviso',tablon_activo boolean default false,tablon_titulo text,tablon_mensaje text);
    create table perfiles(id uuid primary key default gen_random_uuid(),user_id uuid,tienda_id uuid,activo boolean default true,permisos jsonb default '{}');
    create table profesionales(id uuid primary key default gen_random_uuid(),id_tienda uuid);
    insert into auth.users values('${U}'),('${V}');
    grant usage on schema public,auth to authenticated,anon;
  `);
  for(const file of ['superadmin_suscripciones.sql','superadmin_suscripciones_v2.sql','planes_capacidades.sql','planes_comerciales_20261027.sql','planes_operacion_20261027.sql']) {
    let sql=fs.readFileSync(`supabase/${file}`,'utf8').replace('create extension if not exists pgcrypto;','');
    await db.exec(sql);
  }
  // La migración adicional debe poder repetirse sin duplicar datos.
  await db.exec(fs.readFileSync('supabase/planes_operacion_20261027.sql','utf8'));
  await db.exec(`insert into tiendas(id,user_id,nombre,slug) values('${A}','${U}','Principal','principal'),('${B}','${V}','Ajena','ajena');
    grant select on tiendas,perfiles to authenticated;
    grant insert,update on perfiles,tiendas to authenticated;
    grant select on tamaku_planes to authenticated;`);
  await sesion(U);
  const prueba=await q('select * from obtener_estado_suscripcion($1)',[A]);
  check(prueba[0].plan_efectivo,'PREMIUM');check(prueba[0].limite_usuarios,10);check(prueba[0].funcionalidades.multisede,true);
  check((await q('select * from obtener_estado_suscripcion($1)',[B])).length,0);
  await falla('select cambiar_plan_tamaku($1,$2)',[A,'PLATA'],/superadministrador/);
  const campana=(await q("insert into tamaku_comercial(id_tienda,tipo,titulo,etapa) values($1,'CAMPANA','Campaña autorizada','PENDIENTE') returning id",[A]))[0].id;
  await falla("insert into tamaku_comercial(id_tienda,tipo,titulo,etapa) values($1,'TAREA','Dato ajeno','PENDIENTE')",[B],/row-level security/);
  await falla("update tamaku_comercial set id_tienda=$1 where id=$2",[B,campana],/trasladar|row-level security/);
  await falla("insert into tamaku_comercial(id_tienda,tipo,titulo,etapa) values($1,'CAMPANA','Estado inválido','GANADA')",[A],/Estado inválido/);
  const sede=(await q("select crear_sede_tamaku($1,'Sede Norte','Calle 10','3001234567') id",[A]))[0].id;
  check((await q('select * from listar_sedes_tamaku($1)',[A])).length,2);
  check((await q('select contexto_sede_tamaku($1) contexto',[sede]))[0].contexto.tienda_principal,A);
  await sesion(V);
  check((await q('select contexto_sede_tamaku($1) contexto',[sede]))[0].contexto,null);
  check((await q('select * from listar_sedes_tamaku($1)',[A])).length,0);
  check((await q('select * from tamaku_comercial')).length,0);
  await sesion(U);
  await db.exec('reset role');
  await db.exec(`insert into tamaku_superadmins(user_id) values('${U}');`);
  // Prueba → plan solicitado Plata: sigue usando el plan superior.
  await q('select cambiar_plan_tamaku($1,$2)',[A,'PLATA']);
  check((await q('select * from obtener_estado_suscripcion($1)',[A]))[0].plan_efectivo,'PREMIUM');
  await q("update tamaku_suscripciones set estado='ACTIVA',fin_periodo=now()+interval '30 days',plan_id=(select id from tamaku_planes where codigo='PRO') where id_tienda=$1",[A]);
  check((await q('select * from obtener_estado_suscripcion($1)',[sede]))[0].acceso,false);
  await sesion(U);
  check((await q("select plan_tiene_funcion($1,'marketing') permitido",[A]))[0].permitido,true);
  await falla("insert into tamaku_comercial(id_tienda,tipo,titulo,etapa) values($1,'TAREA','Seguimiento avanzado','PENDIENTE')",[A],/row-level security/);
  // Dos empleados adicionales + propietario = 3.
  const empleado1='20000000-0000-0000-0000-000000000001',empleado2='20000000-0000-0000-0000-000000000002';
  await q('insert into perfiles(user_id,tienda_id) values($1,$2),($3,$2)',[empleado1,A,empleado2]);
  await falla('insert into perfiles(user_id,tienda_id) values(gen_random_uuid(),$1)',[A],/permite 3/);
  await falla('select cambiar_plan_tamaku($1,$2)',[A,'PLATA'],/admite 1/);
  await db.exec('reset role');
  await q('update perfiles set activo=false where tienda_id=$1',[A]);
  const antes=(await q('select fin_periodo from tamaku_suscripciones where id_tienda=$1',[A]))[0].fin_periodo;
  await q('select cambiar_plan_tamaku($1,$2)',[A,'PLATA']);
  check((await q('select fin_periodo from tamaku_suscripciones where id_tienda=$1',[A]))[0].fin_periodo,antes);
  check((await q('select count(*)::int n from tamaku_pagos_suscripcion'))[0].n,0);
  await sesion(U);
  await falla('update perfiles set activo=true where user_id=$1',[empleado1],/permite 1/);
  check((await q("select plan_tiene_funcion($1,'reportes') permitido",[A]))[0].permitido,false);
  check((await q('select * from tamaku_comercial')).length,0);
  await falla("update tiendas set tablon_tipo='promocion',tablon_activo=true where id=$1",[A],/Zafiro o Diamante/);
  await q('select cambiar_plan_tamaku($1,$2)',[A,'DIAMANTE']);
  check((await q('select * from tamaku_comercial')).length,1); // Se conserva la campaña al bajar/subir.
  check((await q('select * from obtener_estado_suscripcion($1)',[sede]))[0].plan_efectivo,'PREMIUM');
  await db.exec('reset role');
  // El mismo usuario en dos sedes no consume dos cupos.
  await q('insert into perfiles(user_id,tienda_id) values($1,$2)',[empleado1,sede]);
  await q('update perfiles set activo=true where user_id=$1',[empleado1]);
  check((await q('select total_usuarios_plan_tamaku($1) n',[A]))[0].n,2);
  await falla('select cambiar_plan_tamaku($1,$2)',[sede,'PLATA'],/tienda principal/);
  // La prueba sigue siempre al precio más alto, no a un código fijo.
  await q("update tamaku_planes set precio_mensual=999999,limite_usuarios=4 where codigo='PRO'");
  await q("update tamaku_suscripciones set estado='PRUEBA' where id_tienda=$1",[A]);
  check((await q('select * from obtener_estado_suscripcion($1)',[A]))[0].plan_efectivo,'PRO');
  check((await q('select * from obtener_estado_suscripcion($1)',[A]))[0].limite_usuarios,4);
  console.log(`${comprobaciones} comprobaciones SQL satisfactorias; base efímera cerrada.`);
} finally { await db.close(); }
