import test from 'node:test';
import assert from 'node:assert/strict';
import { crearExcelClientes, obtenerClientesExportacion } from '../assets/js/clientes-export.js';

test('exporta todas las paginas, sin busqueda y solo para la tienda activa', async () => {
  const source = Array.from({ length: 237 }, (_, i) => ({ telefono: String(i) }));
  const offsets = [];
  const result = await obtenerClientesExportacion(null, 'mi-tienda', async (name, args) => {
    assert.equal(name, 'tamaku_clientes_pagina_v1');
    assert.equal(args.p_tienda, 'mi-tienda'); assert.equal(args.p_busqueda, '');
    assert.equal(args.p_categoria, 'todos'); offsets.push(args.p_offset);
    // Simula un servidor que limita las paginas por debajo del cupo solicitado.
    return { items: source.slice(args.p_offset, args.p_offset + 50), total: source.length };
  });
  assert.deepEqual(result, source); assert.deepEqual(offsets, [0, 50, 100, 150, 200]);
});

test('errores de permisos o paginas incompletas no producen una descarga parcial', async () => {
  await assert.rejects(obtenerClientesExportacion(null, 'tienda', async () => { throw Error('Sin permiso'); }), /Sin permiso/);
  await assert.rejects(obtenerClientesExportacion(null, 'tienda', async () => ({ items: [], total: 2 })), /todos los clientes/);
  await assert.rejects(obtenerClientesExportacion(null, '', async () => null), /tienda activa/);
});

test('compatibilidad sin RPC: pagina ambas fuentes, agrupa clientes y conserva bloqueos', async () => {
  const source = { citas: [
    { nombre_cliente: 'Ana', telefono_cliente: '0300 123', email_cliente: 'ANA@test.co', fecha: '2026-11-10', valor_servicio: 20000 },
    { nombre_cliente: 'Ana anterior', telefono_cliente: '0300123', fecha: '2026-10-01', valor_servicio: 15000 },
    { nombre_cliente: 'Sin telefono', telefono_cliente: '', valor_servicio: 5000 },
  ], clientes_bloqueados: [{ telefono_cliente: '0300123', tipo_bloqueo: 'global' }] };
  const supabase = { from(table) { return {
    select() { return this; }, eq(key, value) { assert.equal(key, 'id_tienda'); assert.equal(value, 'tienda'); return this; },
    order() { return this; }, async range(from) { return { data: source[table].slice(from, from + 1) }; },
  }; } };
  const clientes = await obtenerClientesExportacion(supabase, 'tienda', async () => null);
  assert.equal(clientes.length, 1); assert.equal(clientes[0].visitas, 2);
  assert.equal(clientes[0].gastado, 35000); assert.equal(clientes[0].telefono, '0300123');
  assert.equal(clientes[0].bloqueos.length, 1); assert.equal(clientes[0].email, 'ana@test.co');
});

async function unzipStored(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), files = {};
  let offset = 0;
  while (new DataView(bytes.buffer, offset).getUint32(0, true) === 0x04034b50) {
    const view = new DataView(bytes.buffer, offset);
    const size = view.getUint32(18, true), nameSize = view.getUint16(26, true);
    const start = offset + 30 + nameSize;
    const name = new TextDecoder().decode(bytes.slice(offset + 30, start));
    files[name] = new TextDecoder().decode(bytes.slice(start, start + size));
    offset = start + size;
  }
  assert.equal(new DataView(bytes.buffer, bytes.length - 22).getUint32(0, true), 0x06054b50);
  return files;
}

test('XLSX nativo: texto seguro, telefonos con cero, importes numericos y fechas sin desfase', async () => {
  const blob = crearExcelClientes([
    { nombre: 'Zoe & <Familia>', telefono: '0300123', email: '=SUM(A1)', visitas: 5, gastado: 35000, ultimaFecha: '2026-11-10', bloqueos: [{}] },
    { nombre: 'Ana', telefono: '+57300123', visitas: 1, gastado: 0, ultimaFecha: null },
  ], 'Mi tienda');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const files = await unzipStored(blob), sheet = files['xl/worksheets/sheet1.xml'];
  assert.equal(Object.keys(files).length, 6);
  assert.ok(sheet.indexOf('Ana') < sheet.indexOf('Zoe'));
  assert.match(sheet, /Zoe &amp; &lt;Familia&gt;/);
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">0300123/);
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=SUM\(A1\)/);
  assert.ok(!sheet.includes('<f>')); assert.match(sheet, /<v>35000<\/v>/);
  assert.match(sheet, new RegExp(`<v>${Date.parse('2026-11-10T00:00:00Z') / 86400000 + 25569}</v>`));
  assert.match(sheet, /autoFilter ref="A4:H6"/); assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /Bloqueado/); assert.match(sheet, /Sin bloqueo/);
  const empty = await unzipStored(crearExcelClientes([], 'Tienda'));
  assert.match(empty['xl/worksheets/sheet1.xml'], /autoFilter ref="A4:H4"/);
});
