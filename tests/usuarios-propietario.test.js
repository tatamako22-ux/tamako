import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/usuarios/usuarios.js', 'utf8');
function render(perfiles, filtro = '') {
  const elementos = Object.fromEntries(['usersSearch','usersCount','usersDetail','usersList'].map(id => [id, { value: filtro }]));
  const contexto = { document: { querySelector: selector => elementos[selector.slice(1)] } };
  vm.runInNewContext(source.slice(source.indexOf('const $ ='), source.indexOf('function renderPermisos()')) +
    `\nconst tienda = {user_id:'owner', propietario:'Propietario', email:'owner@test.co'}; const perfiles = ${JSON.stringify(perfiles)};\n` +
    source.slice(source.indexOf('function puedeCrearUsuario()'), source.indexOf('function abrirModal(')) + source.slice(source.indexOf('function renderUsuarios()'), source.indexOf('async function cargarDatos()')) + '\nrenderUsuarios();', contexto);
  return elementos;
}
test('incluye propietario sin perfil y empleado en el total y la lista', () => {
  const resultado = render([{id:'staff',user_id:'staff',nombre:'Santy',email:'santy@test.co',activo:true}]);
  assert.equal(resultado.usersCount.textContent, 2);
  assert.match(resultado.usersDetail.textContent, /2 accesos activos/);
  assert.match(resultado.usersList.innerHTML, /owner@test.co/);
  assert.match(resultado.usersList.innerHTML, /santy@test.co/);
  const propietario = resultado.usersList.innerHTML.split('</article>')[0];
  assert.doesNotMatch(propietario, /edit-user|toggle-user/);
});
test('no duplica al propietario con perfil inactivo y permite buscar su correo', () => {
  const resultado = render([{id:'p',user_id:'owner',activo:false}], 'owner@test');
  assert.equal(resultado.usersCount.textContent, 1);
  assert.match(resultado.usersDetail.textContent, /1 accesos activos/);
  assert.equal((resultado.usersList.innerHTML.match(/class="user-card"/g)||[]).length, 1);
  assert.match(resultado.usersList.innerHTML, /Activo/);
});
test('separa inactivos del cupo activo y conserva el filtro por tienda', () => {
  const resultado = render([{id:'staff',user_id:'staff',activo:false}]);
  assert.equal(resultado.usersCount.textContent, 2);
  assert.match(resultado.usersDetail.textContent, /1 accesos activos/);
  assert.match(source, /eq\("tienda_id", tienda.id\)/);
  assert.match(source, /eq\("id_tienda", tienda.id\)/);
});

test('Plata no ofrece otro acceso; planes con cupo disponible si', () => {
  const fn = source.slice(source.indexOf('function puedeCrearUsuario()'), source.indexOf('function abrirModal('));
  for (const [limite, cantidad, esperado] of [[1,0,false],[3,0,true],[3,2,false]]) {
    const context = {tienda:{user_id:'owner',suscripcion:{limite_usuarios:limite}},perfiles:Array.from({length:cantidad},(_,i)=>({user_id:`staff-${i}`,activo:true}))};
    vm.runInNewContext(fn,context);
    assert.equal(context.puedeCrearUsuario(), esperado);
  }
});
