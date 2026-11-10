import { readAllPages } from './core/read-pages.js';

// Usa las mismas fuentes y reglas que el directorio, sin limitarse a su pagina visible.
export async function obtenerClientesExportacion(supabase, tiendaId, optionalSummary) {
  if (!tiendaId) throw new Error('No existe una tienda activa.');
  const items = [];
  while (true) {
    const pagina = await optionalSummary('tamaku_clientes_pagina_v1', {
      p_tienda: tiendaId, p_busqueda: '', p_categoria: 'todos', p_offset: items.length, p_limite: 100,
    });
    if (!pagina) break;
    if (!Array.isArray(pagina.items) || !Number.isFinite(Number(pagina.total))) throw new Error('Respuesta de clientes incompleta.');
    items.push(...pagina.items);
    if (items.length >= Number(pagina.total)) return items;
    if (!pagina.items.length) throw new Error('No fue posible descargar todos los clientes.');
  }
  const [citas, bloqueos] = await Promise.all([
    readAllPages(() => supabase.from('citas')
      .select('nombre_cliente,telefono_cliente,email_cliente,fecha,valor_servicio')
      .eq('id_tienda', tiendaId).order('fecha', { ascending: false }).order('id_cita')),
    readAllPages(() => supabase.from('clientes_bloqueados')
      .select('id,telefono_cliente,tipo_bloqueo').eq('id_tienda', tiendaId).order('id')),
  ]);
  const clientes = new Map();
  for (const cita of citas) {
    const telefono = String(cita.telefono_cliente || '').replace(/\D/g, '');
    if (!telefono) continue;
    if (!clientes.has(telefono)) clientes.set(telefono, {
      nombre: cita.nombre_cliente || 'CLIENTE', telefono, email: '', visitas: 0,
      gastado: 0, ultimaFecha: cita.fecha, bloqueos: [],
    });
    const cliente = clientes.get(telefono);
    if (!cliente.email && cita.email_cliente?.includes('@')) cliente.email = cita.email_cliente.toLowerCase();
    cliente.visitas++;
    cliente.gastado += Number(cita.valor_servicio || 0);
    if (cita.fecha > cliente.ultimaFecha) cliente.ultimaFecha = cita.fecha;
  }
  const bloqueosPorTelefono = new Map();
  for (const bloqueo of bloqueos) {
    const tel = String(bloqueo.telefono_cliente || '').replace(/\D/g, '').slice(-10);
    if (!bloqueosPorTelefono.has(tel)) bloqueosPorTelefono.set(tel, []);
    bloqueosPorTelefono.get(tel).push(bloqueo);
  }
  for (const cliente of clientes.values()) cliente.bloqueos = bloqueosPorTelefono.get(cliente.telefono.slice(-10)) || [];
  return [...clientes.values()];
}

const xml = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const encoder = new TextEncoder();

// ZIP sin compresion: XLSX nativo, sin servicios externos ni librerias de CDN.
function zip(files) {
  let offset = 0;
  const parts = [], directory = [];
  for (const [path, source] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(source);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(12, 33, true); l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    parts.push(local, data); directory.push(central); offset += local.length + data.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true);
  e.setUint16(10, directory.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function crearExcelClientes(clientes, tienda, fecha = new Date()) {
  if (clientes.length > 1048571) throw new Error('La lista supera el limite de filas de Excel.');
  const text = (ref, value, style = 0) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const number = (ref, value, style = 0) => `<c r="${ref}" s="${style}"><v>${Number.isFinite(Number(value)) ? Number(value) : 0}</v></c>`;
  const headers = ['Nombre', 'Telefono / WhatsApp', 'Correo electronico', 'Visitas', 'Total gastado (COP)', 'Ultima visita', 'Categoria', 'Estado'];
  const rows = [
    `<row r="1" ht="30" customHeight="1">${text('A1', `TAMAKU | Clientes de ${tienda || 'la tienda'}`, 1)}</row>`,
    `<row r="2" ht="25" customHeight="1">${text('A2', `${clientes.length} clientes | Exportado: ${fecha.toLocaleString('es-CO', { timeZone: 'America/Bogota' })} | Directorio completo`, 2)}</row>`,
    `<row r="4" ht="30" customHeight="1">${headers.map((h, i) => text(`${String.fromCharCode(65 + i)}4`, h, 3)).join('')}</row>`,
  ];
  [...clientes].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')).forEach((cliente, i) => {
    const r = i + 5, base = i % 2 ? 5 : 4;
    const iso = String(cliente.ultimaFecha || '').slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN;
    rows.push(`<row r="${r}" ht="24" customHeight="1">${[
      text(`A${r}`, cliente.nombre, base), text(`B${r}`, cliente.telefono, base),
      text(`C${r}`, cliente.email === 'Sin correo' ? '' : cliente.email, base),
      number(`D${r}`, cliente.visitas, base), number(`E${r}`, cliente.gastado, i % 2 ? 7 : 6),
      Number.isFinite(date) ? number(`F${r}`, date / 86400000 + 25569, i % 2 ? 9 : 8) : text(`F${r}`, '', base),
      text(`G${r}`, Number(cliente.visitas) >= 5 ? 'VIP' : 'Frecuente', base),
      text(`H${r}`, cliente.bloqueos?.length ? 'Bloqueado' : 'Sin bloqueo', base),
    ].join('')}</row>`);
  });
  const fill = ['FFFFFFFF', 'FFF6F3EC'];
  const xf = (font, fillId, numFmt = 0) => `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`;
  return zip({
    '[Content_Types].xml': `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${declaration}<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `${declaration}<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF806020"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill.map(color => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}<fill><patternFill patternType="solid"><fgColor rgb="FF28241B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">${xf(0, 0)}${xf(1, 0)}${xf(0, 0)}${xf(2, 4)}${xf(0, 2)}${xf(0, 3)}${xf(0, 2, 164)}${xf(0, 3, 164)}${xf(0, 2, 14)}${xf(0, 3, 14)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `${declaration}<worksheet xmlns="${ns}"><dimension ref="A1:H${clientes.length + 4}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${[34, 24, 42, 12, 24, 18, 16, 20].map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A4:H${clientes.length + 4}"/><mergeCells count="2"><mergeCell ref="A1:H1"/><mergeCell ref="A2:H2"/></mergeCells></worksheet>`,
  });
}

export function descargarExcelClientes(blob, tienda = 'tienda') {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url;
  link.download = `Clientes_${String(tienda).replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 70)}_${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
