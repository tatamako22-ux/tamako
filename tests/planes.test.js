import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PLANES, codigoPlan, nombrePlan, permiteFuncion } from '../assets/js/core/planes.js';

test('los enlaces nuevos y antiguos identifican la misma suscripción', () => {
  for (const [slug, codigo] of [['plata', 'BASICO'], ['zafiro', 'PRO'], ['diamante', 'PREMIUM']]) {
    assert.equal(codigoPlan(slug), codigo);
    assert.equal(codigoPlan(codigo.toLowerCase()), codigo);
    assert.equal(nombrePlan(slug), PLANES[codigo].nombre);
  }
  assert.equal(nombrePlan('PRUEBA'), 'Prueba gratuita');
  assert.equal(permiteFuncion(null, 'reportes'), false);
  assert.equal(permiteFuncion({ suscripcion: { funcionalidades: { reportes: false } } }, 'reportes'), false);
});

async function facturacion({ reportes, propietario = true, permiso = false, hash = '#reportes' }) {
  const botones = ['facturas', 'reportes'].map(nombre => ({
    dataset: { tab: nombre }, hidden: false, listeners: {},
    classList: { add() {}, remove() {} },
    addEventListener(evento, fn) { this.listeners[evento] = fn; },
  }));
  const paneles = botones.map(() => ({ hidden: false, activaciones: 0,
    classList: { add() { this.parent.activaciones++; }, remove() {}, parent: null },
  }));
  paneles.forEach(panel => panel.classList.parent = panel);
  const llamadas = [];
  const entorno = {
    console: { log() {}, error(error) { throw error; } },
    document: {
      querySelector(selector) { return botones.find(b => selector.includes(`"${b.dataset.tab}"`)); },
      querySelectorAll(selector) { return selector === '.tab-btn' ? botones : paneles; },
      getElementById(id) { return paneles[botones.findIndex(b => id === `tab-${b.dataset.tab}`)]; },
    },
    window: {
      tamakuContextReady: Promise.resolve({ suscripcion: { funcionalidades: { reportes } }, sesion: { es_propietario: propietario, permisos: { reportes_ver: permiso } } }),
      location: { hash }, addEventListener() {},
    },
    history: { replaceState() {} }, permiteFuncion,
  };
  for (const nombre of ['Modal', 'Cuentas', 'Facturas', 'Caja', 'Reportes', 'Insumos']) {
    entorno[`Facturacion${nombre}`] = { init() { llamadas.push(nombre); } };
  }
  const codigo = fs.readFileSync(new URL('../assets/js/facturacion/facturacion.init.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export const initFacturacion', 'globalThis.initFacturacion');
  vm.runInNewContext(codigo, entorno);
  await entorno.initFacturacion();
  return { botones, paneles, llamadas };
}

test('Plata conserva ventas y bloquea informes incluso entrando por #reportes', async () => {
  const { botones, paneles, llamadas } = await facturacion({ reportes: false });
  assert.equal(botones[1].hidden, true);
  assert.equal(paneles[1].hidden, true);
  assert.equal(paneles[1].activaciones, 0);
  assert.ok(llamadas.includes('Facturas'));
  assert.ok(!llamadas.includes('Reportes'));
  botones[1].listeners.click();
  assert.equal(paneles[1].activaciones, 0);
});

test('informes requieren el plan y el permiso del usuario', async () => {
  const sinPermiso = await facturacion({ reportes: true, propietario: false });
  assert.ok(!sinPermiso.llamadas.includes('Reportes'));
  const autorizado = await facturacion({ reportes: true, propietario: false, permiso: true });
  assert.ok(autorizado.llamadas.includes('Reportes'));
  assert.equal(autorizado.paneles[1].activaciones, 1);
});

test('el servicio de informes consulta la suscripción antes de leer datos', async () => {
  const source = fs.readFileSync(new URL('../assets/js/facturacion/facturacion.service.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export const FacturacionService', 'globalThis.FacturacionService');
  let lecturas = 0;
  const entorno = { supabase: {
    rpc: async () => ({ data: false, error: null }),
    from() { lecturas++; throw new Error('No debe leer datos'); },
  }};
  vm.runInNewContext(source, entorno);
  await assert.rejects(entorno.FacturacionService.getDatosReporte('tienda', '2026-10-01', '2026-10-27'), /Zafiro y Diamante/);
  assert.equal(lecturas, 0);
  entorno.supabase.rpc = async () => ({ data: null, error: new Error('Sin conexión') });
  await assert.rejects(entorno.FacturacionService.getDatosReporte('tienda', '2026-10-01', '2026-10-27'), /Sin conexión/);
  assert.equal(lecturas, 0);
});
