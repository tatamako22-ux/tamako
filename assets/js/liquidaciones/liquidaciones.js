import { supabase } from "../config/supabaseClient.js";
import { requireTiendaInfo } from "../core/session.js";

const $ = (selector) => document.querySelector(selector);
const dinero = new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const escapar = (valor="") => String(valor).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
let tienda, profesionales=[], facturas=[], citas=[], pagos=[], cuentas=[], servicios=[], seleccionado=null;
let filtroCalendario="TODOS";

function fechaLocal(fecha){const d=new Date(fecha);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function inicioMes(){const d=new Date();return fechaLocal(new Date(d.getFullYear(),d.getMonth(),1))}
function finMes(){const d=new Date();return fechaLocal(new Date(d.getFullYear(),d.getMonth()+1,0))}
function pagada(f){return String(f.estado).toUpperCase()==="PAGADA"}
function totalDetalles(f){return (f.factura_detalles||[]).reduce((s,d)=>s+Number(d.total_linea??Number(d.precio_unitario||0)*Number(d.cantidad||1)-Number(d.descuento||0)),0)}
function gananciaFactura(f,p){
  if(p.modalidad_pago==="MENSUALIDAD") return 0;
  const detalles=f.factura_detalles||[];
  if(detalles.length) return detalles.reduce((s,d)=>s+Number(d.valor_profesional??(Number(d.total_linea||0)*Number(p.porcentaje_comision||0)/100)),0);
  return Number(f.total||0)*Number(p.porcentaje_comision||0)/100;
}
function mensualidadPeriodo(p){
  const desde=new Date(`${$("#periodoDesde").value}T00:00:00`),hasta=new Date(`${$("#periodoHasta").value}T00:00:00`);
  const contrato=p.contrato_desde?new Date(`${p.contrato_desde}T00:00:00`):desde;
  let cursor=new Date(Math.max(desde,contrato)),total=0;
  while(cursor<=hasta){
    const finMesActual=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
    const finTramo=finMesActual<hasta?finMesActual:hasta;
    const diasMes=finMesActual.getDate(),dias=Math.floor((finTramo-cursor)/86400000)+1;
    total+=Number(p.mensualidad||0)*(dias/diasMes);
    cursor=new Date(finTramo);cursor.setDate(cursor.getDate()+1);
  }
  return Math.round(total);
}
function resumenProfesional(p){
  const propias=facturas.filter(f=>String(f.id_barbero)===String(p.id_barbero)&&pagada(f));
  const citasProfesional=citas.filter(c=>String(c.id_barbero)===String(p.id_barbero));
  const idsFacturados=new Set(propias.map(f=>f.id_cita).filter(Boolean).map(String));
  const canceladas=citasProfesional.filter(c=>String(c.estado).toUpperCase()==="CANCELADA").length;
  const inasistencias=citasProfesional.filter(c=>String(c.estado).toUpperCase()==="NO_ASISTIO");
  const noAsistieron=inasistencias.length;
  const valorNoAsistieron=inasistencias.reduce((s,c)=>s+valorEsperadoCita(c),0);
  const facturadas=citasProfesional.filter(c=>!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase())&&idsFacturados.has(String(c.id_cita))).length;
  const sinFacturar=citasProfesional.filter(c=>c.fecha<=fechaLocal(new Date())&&!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase())&&!idsFacturados.has(String(c.id_cita))).length;
  const produccion=propias.reduce((s,f)=>s+Number(f.total||totalDetalles(f)),0);
  const recibido=propias.filter(f=>String(f.destino_pago).toUpperCase()==="PROFESIONAL").reduce((s,f)=>s+Number(f.total||0),0);
  const corresponde=p.modalidad_pago==="MENSUALIDAD"?mensualidadPeriodo(p):propias.reduce((s,f)=>s+gananciaFactura(f,p),0);
  const pagado=pagos.filter(x=>String(x.id_profesional)===String(p.id_barbero)).reduce((s,x)=>s+Number(x.monto||0),0);
  return {p,propias,produccion,recibido,corresponde,pagado,facturadas,sinFacturar,canceladas,noAsistieron,valorNoAsistieron,inasistencias,totalCitas:citasProfesional.length,saldo:corresponde-pagado-recibido,tienda:produccion-corresponde};
}
function normalizar(texto){return String(texto||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function servicioDeCita(c){return servicios.find(s=>String(s.id_barbero)===String(c.id_barbero)&&(String(c.servicio)===String(s.id_servicio)||normalizar(c.servicio_nombre||c.servicio)===normalizar(s.nombre_servicio)))}
function valorEsperadoCita(c){return Number(servicioDeCita(c)?.precio||c.valor_servicio||0)}
function desgloseServicios(r){
  const catalogo=servicios.filter(s=>String(s.id_barbero)===String(r.p.id_barbero));
  const idsFacturados=new Set(r.propias.map(f=>f.id_cita).filter(Boolean).map(String));
  const identificadas=new Set();
  const filas=catalogo.map(servicio=>{
    const asociadas=citas.filter(c=>String(c.id_barbero)===String(r.p.id_barbero)&&(String(c.servicio)===String(servicio.id_servicio)||normalizar(c.servicio_nombre||c.servicio)===normalizar(servicio.nombre_servicio)));
    asociadas.forEach(c=>identificadas.add(String(c.id_cita)));
    const canceladas=asociadas.filter(c=>String(c.estado).toUpperCase()==="CANCELADA").length;
    const noAsistieron=asociadas.filter(c=>String(c.estado).toUpperCase()==="NO_ASISTIO").length;
    const validas=asociadas.filter(c=>!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase()));
    const facturadas=validas.filter(c=>idsFacturados.has(String(c.id_cita))).length;
    const sinFacturar=validas.filter(c=>c.fecha<=fechaLocal(new Date())&&!idsFacturados.has(String(c.id_cita))).length;
    const precio=Number(servicio.precio||0);
    return {nombre:servicio.nombre_servicio,precio,cantidad:validas.length,facturadas,sinFacturar,canceladas,noAsistieron,perdido:precio*noAsistieron,total:precio*validas.length};
  });
  const desconocidas=citas.filter(c=>String(c.id_barbero)===String(r.p.id_barbero)&&!identificadas.has(String(c.id_cita)));
  if(desconocidas.length) filas.push({nombre:"Sin identificar",precio:0,cantidad:desconocidas.filter(c=>!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase())).length,facturadas:desconocidas.filter(c=>!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase())&&idsFacturados.has(String(c.id_cita))).length,sinFacturar:desconocidas.filter(c=>c.fecha<=fechaLocal(new Date())&&!["CANCELADA","NO_ASISTIO"].includes(String(c.estado).toUpperCase())&&!idsFacturados.has(String(c.id_cita))).length,canceladas:desconocidas.filter(c=>String(c.estado).toUpperCase()==="CANCELADA").length,noAsistieron:desconocidas.filter(c=>String(c.estado).toUpperCase()==="NO_ASISTIO").length,perdido:desconocidas.filter(c=>String(c.estado).toUpperCase()==="NO_ASISTIO").reduce((s,c)=>s+Number(c.valor_servicio||0),0),total:0});
  const esperado=filas.reduce((s,f)=>s+f.total,0);
  return `<section class="liq-services full"><header><div><span>PRODUCCIÓN ESPERADA POR SERVICIO</span><strong>${dinero.format(esperado)}</strong></div><small>Cancelaciones e inasistencias no se incluyen en la producción.</small></header><div class="liq-services-head"><span>Servicio</span><span>Citas</span><span>Control</span><span>Cálculo</span><span>Total esperado</span></div>${filas.map(f=>`<article><div><strong>${escapar(f.nombre)}</strong><small>${f.canceladas} canceladas · <i class="no-show-text">${f.noAsistieron} no asistieron (${dinero.format(f.perdido)})</i></small></div><b>${f.cantidad}</b><span>${f.facturadas} fact. · ${f.sinFacturar} sin facturar</span><code>${dinero.format(f.precio)} × ${f.cantidad}</code><strong>${dinero.format(f.total)}</strong></article>`).join("")||'<div class="liq-empty">Este profesional no tiene servicios asignados.</div>'}</section>`;
}
function listaInasistencias(r){
  if(!r.inasistencias.length)return '<section class="liq-absences full"><header><span>INASISTENCIAS DEL PERIODO</span><strong>Sin inasistencias</strong></header></section>';
  return `<section class="liq-absences full"><header><div><span>INASISTENCIAS DEL PERIODO</span><strong>${r.noAsistieron} clientes · ${dinero.format(r.valorNoAsistieron)} no facturados</strong></div></header>${r.inasistencias.map(c=>`<article><span><strong>${escapar(c.nombre_cliente||"Cliente sin nombre")}</strong><small>${escapar(c.telefono_cliente||"Sin teléfono")}</small></span><span><b>${c.fecha} ${escapar(c.hora_inicio||"")}</b><small>${escapar(c.servicio_nombre||c.servicio||"Servicio sin identificar")}</small></span><strong>${dinero.format(valorEsperadoCita(c))}</strong></article>`).join("")}</section>`;
}
function calendarioProfesional(r){
  const desde=new Date(`${$("#periodoDesde").value}T00:00:00`),hasta=new Date(`${$("#periodoHasta").value}T00:00:00`),hoy=fechaLocal(new Date());
  const esToda=tienda.sesion.es_propietario&&filtroCalendario==="TODOS",idFiltro=esToda?null:(filtroCalendario==="TODOS"?r.p.id_barbero:filtroCalendario);
  const citasAlcance=citas.filter(c=>!idFiltro||String(c.id_barbero)===String(idFiltro));
  const facturasAlcance=facturas.filter(f=>pagada(f)&&(!idFiltro||String(f.id_barbero)===String(idFiltro)));
  const facturasPorCita=new Map();
  facturasAlcance.filter(f=>f.id_cita).forEach(f=>{const id=String(f.id_cita);facturasPorCita.set(id,(facturasPorCita.get(id)||0)+Number(f.total||0))});
  const dias=[];let esperadoPeriodo=0,facturadoPeriodo=0,sinDefinirPeriodo=0;
  for(let cursor=new Date(desde);cursor<=hasta;cursor.setDate(cursor.getDate()+1)){
    const key=fechaLocal(cursor),citasDia=citasAlcance.filter(c=>c.fecha===key);
    let esperado=0,facturado=0,pendientes=0,canceladas=0,facturadasDia=0,sinDefinir=0;
    citasDia.forEach(c=>{
      const servicio=servicios.find(s=>String(s.id_barbero)===String(c.id_barbero)&&(String(c.servicio)===String(s.id_servicio)||normalizar(c.servicio_nombre||c.servicio)===normalizar(s.nombre_servicio)));
      if(!servicio)sinDefinir+=1;
      if(String(c.estado).toUpperCase()==="CANCELADA"){canceladas+=1;return}
      esperado+=Number(servicio?.precio||0);
      const cobrado=facturasPorCita.get(String(c.id_cita))||0;
      if(cobrado>0){facturadasDia+=1;facturado+=cobrado}else if(key<=hoy){pendientes+=1}
    });
    esperadoPeriodo+=esperado;facturadoPeriodo+=facturado;sinDefinirPeriodo+=sinDefinir;
    dias.push({key,dia:cursor.getDate(),citas:citasDia.length,esperado,facturado,pendientes,canceladas,facturadas:facturadasDia,sinDefinir,futuro:key>hoy});
  }
  const blancos=(desde.getDay()+6)%7;
  const opciones=tienda.sesion.es_propietario?`<label class="liq-calendar-filter">Ver calendario<select id="filtroCalendarioProfesional"><option value="TODOS" ${filtroCalendario==="TODOS"?"selected":""}>Toda la tienda</option>${profesionales.map(p=>`<option value="${p.id_barbero}" ${String(filtroCalendario)===String(p.id_barbero)?"selected":""}>${escapar(p.nombre_empleado)}</option>`).join("")}</select></label>`:"";
  const nombreVista=esToda?"Toda la tienda":profesionales.find(p=>String(p.id_barbero)===String(idFiltro))?.nombre_empleado||r.p.nombre_empleado;
  return `<section class="liq-calendar full"><header><div><span>CALENDARIO DEL PERIODO · ${escapar(nombreVista)}</span><h3>${desde.toLocaleDateString("es-CO",{month:"long",year:"numeric"})}${desde.getMonth()!==hasta.getMonth()||desde.getFullYear()!==hasta.getFullYear()?` – ${hasta.toLocaleDateString("es-CO",{month:"long",year:"numeric"})}`:""}</h3></div><div class="liq-calendar-actions">${opciones}<div class="liq-calendar-totals"><span>Esperado <b>${dinero.format(esperadoPeriodo)}</b></span><span>Facturado <b>${dinero.format(facturadoPeriodo)}</b></span><span class="undefined">Sin definir <b>${sinDefinirPeriodo}</b></span></div></div></header><div class="liq-calendar-scroll"><div class="liq-weekdays">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=>`<span>${d}</span>`).join("")}</div><div class="liq-calendar-grid">${Array.from({length:blancos},()=>'<i class="liq-day-empty"></i>').join("")}${dias.map(d=>`<article class="liq-day ${d.pendientes?"has-pending":""} ${d.canceladas?"has-cancelled":""} ${d.sinDefinir?"has-undefined":""} ${d.key===hoy?"is-today":""} ${d.futuro?"is-future":""}"><header><b>${d.dia}</b><span>${d.citas} cita${d.citas===1?"":"s"}</span></header><strong>${dinero.format(d.esperado)}</strong><small>${d.facturadas} fact. · ${d.pendientes} pendientes</small>${d.sinDefinir?`<em class="undefined">${d.sinDefinir} sin definir</em>`:""}${d.canceladas?`<em>${d.canceladas} cancelada${d.canceladas===1?"":"s"}</em>`:""}</article>`).join("")}</div></div></section>`;
}
function avisar(mensaje,tipo="success"){$("#liqToast").textContent=mensaje;$("#liqToast").className=`liq-toast ${tipo} show`;setTimeout(()=>$("#liqToast").classList.remove("show"),5000)}

async function cargar(){
  const desde=$("#periodoDesde").value,hasta=$("#periodoHasta").value;
  let qProfesionales=supabase.from("profesionales").select("id_barbero,nombre_empleado,modalidad_pago,porcentaje_comision,mensualidad,contrato_desde").eq("id_tienda",tienda.id).order("nombre_empleado");
  if(!tienda.sesion.es_propietario) qProfesionales=qProfesionales.eq("id_barbero",tienda.sesion.id_profesional);
  let qFacturas=supabase.from("facturas").select("id_factura,id_cita,id_barbero,total,estado,destino_pago,metodo_pago,fecha_emision,factura_detalles(total_linea,precio_unitario,cantidad,descuento,valor_profesional,valor_tienda,porcentaje_snapshot)").eq("id_tienda",tienda.id).gte("fecha_emision",`${desde}T00:00:00`).lte("fecha_emision",`${hasta}T23:59:59`);
  let qCitas=supabase.from("citas").select("id_cita,id_barbero,estado,fecha,hora_inicio,nombre_cliente,telefono_cliente,servicio,servicio_nombre,valor_servicio").eq("id_tienda",tienda.id).gte("fecha",desde).lte("fecha",hasta);
  let qPagos=supabase.from("pagos_profesionales").select("*,profesionales(nombre_empleado),cuentas_financieras(nombre)").eq("id_tienda",tienda.id).gte("periodo_hasta",desde).lte("periodo_desde",hasta).order("fecha_pago",{ascending:false});
  let qServicios=supabase.from("servicios").select("id_servicio,id_barbero,nombre_servicio,precio").eq("id_tienda",tienda.id).order("nombre_servicio");
  if(!tienda.sesion.es_propietario){qFacturas=qFacturas.eq("id_barbero",tienda.sesion.id_profesional);qCitas=qCitas.eq("id_barbero",tienda.sesion.id_profesional);qPagos=qPagos.eq("id_profesional",tienda.sesion.id_profesional);qServicios=qServicios.eq("id_barbero",tienda.sesion.id_profesional)}
  const consultas=[qProfesionales,qFacturas,qCitas,qPagos,qServicios];
  if(tienda.sesion.es_propietario) consultas.push(supabase.from("cuentas_financieras").select("id,nombre,tipo,saldo_actual").eq("id_tienda",tienda.id).eq("activa",true).order("nombre"));
  const resultados=await Promise.all(consultas);const error=resultados.find(r=>r.error)?.error;if(error)throw error;
  profesionales=resultados[0].data||[];facturas=resultados[1].data||[];citas=resultados[2].data||[];pagos=resultados[3].data||[];servicios=resultados[4].data||[];cuentas=resultados[5]?.data||[];
  seleccionado=profesionales.find(p=>String(p.id_barbero)===String(seleccionado?.id_barbero))||profesionales[0]||null;render();
}

function render(){
  const resumenes=profesionales.map(resumenProfesional);const total=campo=>resumenes.reduce((s,r)=>s+Number(r[campo]||0),0);
  $("#kpiCitasFacturadas").textContent=total("facturadas");$("#kpiCitasSinFacturar").textContent=total("sinFacturar");$("#kpiCitasCanceladas").textContent=total("canceladas");$("#kpiNoAsistieron").textContent=total("noAsistieron");$("#kpiValorNoAsistieron").textContent=`${dinero.format(total("valorNoAsistieron"))} no facturados`;$("#kpiProduccion").textContent=dinero.format(total("produccion"));$("#kpiProfesionales").textContent=dinero.format(total("corresponde"));$("#kpiTienda").textContent=dinero.format(total("tienda"));$("#kpiPendiente").textContent=dinero.format(total("saldo"));
  if(tienda.sesion.es_propietario){$("#listaProfesionales").innerHTML=resumenes.map(r=>`<button class="liq-row" data-profesional="${r.p.id_barbero}"><span><strong>${escapar(r.p.nombre_empleado)}</strong><small>${r.recibido?`Recibió directamente ${dinero.format(r.recibido)}`:"Ingresos recibidos por la tienda"}</small></span><span><b>${r.p.modalidad_pago==="MENSUALIDAD"?"Mensualidad":`${Number(r.p.porcentaje_comision||0)}%`}</b></span><span class="liq-citas-cell"><b>${r.facturadas} fact.</b><small>${r.sinFacturar} sin facturar · ${r.canceladas} canceladas</small></span><b>${dinero.format(r.produccion)}</b><b>${dinero.format(r.corresponde)}</b><b class="saldo ${r.saldo<0?"debe":""}">${dinero.format(r.saldo)}</b></button>`).join("")||'<div class="liq-empty">No hay profesionales registrados.</div>'}
  renderDetalle();renderHistorial();
}
function renderDetalle(){
  if(!seleccionado){$("#detalleLiquidacion").innerHTML='<div class="liq-empty">No hay información para mostrar.</div>';return}
  const r=resumenProfesional(seleccionado);$("#tituloDetalle").textContent=tienda.sesion.es_propietario?seleccionado.nombre_empleado:"Mis ganancias";
  $("#estadoLiquidacion").textContent=r.saldo<0?`Debe entregar ${dinero.format(Math.abs(r.saldo))}`:`Pendiente ${dinero.format(r.saldo)}`;
  $("#detalleLiquidacion").innerHTML=`
    <article class="liq-detail-card"><span>Citas facturadas</span><strong>${r.facturadas}</strong><small>Con factura pagada vinculada</small></article>
    <article class="liq-detail-card liq-warning"><span>Sin facturar</span><strong>${r.sinFacturar}</strong><small>Requieren revisión o cobro</small></article>
    <article class="liq-detail-card liq-cancelled"><span>Canceladas</span><strong>${r.canceladas}</strong><small>No generan producción</small></article>
    <article class="liq-detail-card liq-no-show"><span>No asistieron</span><strong>${r.noAsistieron}</strong><small>${dinero.format(r.valorNoAsistieron)} que no se facturaron</small></article>
    <article class="liq-detail-card"><span>Modalidad</span><strong>${r.p.modalidad_pago==="MENSUALIDAD"?"Mensualidad":"Porcentaje"}</strong><small>${r.p.modalidad_pago==="MENSUALIDAD"?dinero.format(r.p.mensualidad):`${Number(r.p.porcentaje_comision||0)}% de servicios pagados`}</small></article>
    ${desgloseServicios(r)}
    ${listaInasistencias(r)}
    ${calendarioProfesional(r)}
    <article class="liq-detail-card"><span>Producción facturada</span><strong>${dinero.format(r.produccion)}</strong><small>${r.propias.length} facturas pagadas</small></article>
    <article class="liq-detail-card"><span>Mi ganancia</span><strong>${dinero.format(r.corresponde)}</strong><small>Valor ganado en el periodo</small></article>
    <article class="liq-detail-card"><span>Pagos recibidos</span><strong>${dinero.format(r.pagado)}</strong><small>Entregados por la tienda</small></article>
    ${tienda.sesion.es_propietario?`<article class="liq-detail-card"><span>Ganancia tienda</span><strong>${dinero.format(r.tienda)}</strong><small>Bruta antes de gastos e insumos</small></article><article class="liq-detail-card"><span>Dinero cobrado por profesional</span><strong>${dinero.format(r.recibido)}</strong><small>Se descuenta de la liquidación</small></article><article class="liq-detail-card full"><div><span>Saldo conciliado</span><strong>${dinero.format(Math.abs(r.saldo))}</strong><small>${r.saldo<0?"El profesional debe entregar este valor a la tienda":"La tienda debe pagar este valor al profesional"}</small></div>${r.saldo>0?'<button id="abrirPagoProfesional">Registrar pago</button>':""}</article>`:""}`;
  $("#abrirPagoProfesional")?.addEventListener("click",abrirPago);
  $("#filtroCalendarioProfesional")?.addEventListener("change",event=>{filtroCalendario=event.target.value;renderDetalle()});
}
function renderHistorial(){const lista=pagos.filter(p=>!seleccionado||String(p.id_profesional)===String(seleccionado.id_barbero));$("#historialPagos").innerHTML=lista.map(p=>`<article><span><strong>${escapar(p.profesionales?.nombre_empleado||seleccionado?.nombre_empleado||"Profesional")}</strong><small>${new Date(p.fecha_pago).toLocaleDateString("es-CO")}</small></span><span>${p.periodo_desde}<small>hasta ${p.periodo_hasta}</small></span><span>${escapar(p.cuentas_financieras?.nombre||"Cuenta")}</span><strong>${dinero.format(p.monto)}</strong></article>`).join("")||'<div class="liq-empty">No hay pagos registrados en este periodo.</div>'}
function abrirPago(){const r=resumenProfesional(seleccionado);$("#pagoProfesionalNombre").textContent=seleccionado.nombre_empleado;$("#pagoDesde").value=$("#periodoDesde").value;$("#pagoHasta").value=$("#periodoHasta").value;$("#pagoMontoProfesional").value=Math.max(0,Math.round(r.saldo));$("#pagoCuenta").innerHTML=cuentas.map(c=>`<option value="${c.id}">${escapar(c.nombre)} · ${dinero.format(c.saldo_actual)}</option>`).join("");$("#modalPagoProfesional").hidden=false}
$("#actualizarLiquidaciones").onclick=()=>cargar().catch(e=>avisar(e.message,"error"));$("#cerrarPagoProfesional").onclick=()=>$("#modalPagoProfesional").hidden=true;
$("#listaProfesionales").onclick=e=>{const fila=e.target.closest("[data-profesional]");if(!fila)return;seleccionado=profesionales.find(p=>String(p.id_barbero)===fila.dataset.profesional);renderDetalle();renderHistorial()};
$("#formPagoProfesional").onsubmit=async e=>{e.preventDefault();const boton=e.submitter||e.currentTarget.querySelector('[type="submit"]');boton.disabled=true;const {error}=await supabase.rpc("registrar_pago_profesional",{p_tienda:tienda.id,p_profesional:seleccionado.id_barbero,p_cuenta:$("#pagoCuenta").value,p_monto:Number($("#pagoMontoProfesional").value),p_desde:$("#pagoDesde").value,p_hasta:$("#pagoHasta").value,p_referencia:$("#pagoReferencia").value||null,p_notas:$("#pagoNotas").value||null});boton.disabled=false;if(error)return avisar(error.message,"error");$("#modalPagoProfesional").hidden=true;avisar("Pago registrado y descontado de la cuenta correctamente.");await cargar()};

async function init(){tienda=await requireTiendaInfo();if(!tienda)return;if(!tienda.sesion.es_propietario&&!tienda.sesion.id_profesional)return location.replace("dashboard.html");document.body.classList.toggle("professional-view",!tienda.sesion.es_propietario);if(!tienda.sesion.es_propietario){$("#tituloLiquidaciones").textContent="Mis ganancias";$("#subtituloLiquidaciones").textContent="Consulta tu producción, citas y pagos personales.";$("#labelGananciaProfesional").textContent="Mi ganancia"}$("#periodoDesde").value=inicioMes();$("#periodoHasta").value=finMes();await cargar()}
init().catch(e=>{console.error(e);avisar(`No se pudo cargar: ${e.message}`,"error")});
