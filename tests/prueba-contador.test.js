import test from 'node:test';
import assert from 'node:assert/strict';
import { tiempoPrueba } from '../assets/js/core/prueba-contador.js';
test('cuenta dias completos y llega a cero sin numeros negativos',()=>{
 const now=Date.UTC(2026,10,8);
 assert.deepEqual(tiempoPrueba(now+7*86400000,now),{dias:7,horas:0,minutos:0,segundos:0,total:604800});
 assert.equal(tiempoPrueba(now-1000,now).total,0);
 assert.equal(tiempoPrueba('invalido',now),null);
 assert.deepEqual(tiempoPrueba(now+90061000,now),{dias:1,horas:1,minutos:1,segundos:1,total:90061});
});
