import { supabase } from './config/supabaseClient.js';
import { permiteFuncion, nombrePlan } from './core/planes.js';
import { cambiarSede } from './core/session.js';
import { readAllPages } from './core/read-pages.js';

const $ = id => document.getElementById(id);
const escapar = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const dinero = new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
const configuracion = {
  CAMPANA: { titulo:'Marketing & Sales', descripcion:'Organiza campañas, mensajes, presupuesto y fechas. Abre cada conversación autorizada en WhatsApp para revisarla y enviarla.', funcion:'marketing' },
  OPORTUNIDAD: { titulo:'Oportunidades comerciales', descripcion:'Sigue cada contacto desde la primera conversación hasta la venta ganada o perdida.', funcion:'marketing' },
  TAREA: { titulo:'CRM avanzado', descripcion:'Programa seguimientos, registra notas del contacto y controla tareas pendientes o completadas.', funcion:'crm_avanzado' },
  SEDE: { titulo:'Administración Multi-Sede', descripcion:'Crea sedes y entra a la agenda, clientes, equipo y ventas de cada ubicación. El plan y los usuarios se comparten.', funcion:'multisede' },
};
const fases = tipo => tipo==='OPORTUNIDAD' ? ['NUEVA','CONTACTADA','PROPUESTA','GANADA','PERDIDA'] : ['PENDIENTE','EN_CURSO','COMPLETADA'];
let tienda, modulo='CAMPANA', registros=[], version=0;
const formulario = $('growthForm');
const campo = nombre => formulario.elements.namedItem(nombre);
const errorTexto = error => /schema cache|does not exist|could not find/i.test(error.message || '')
  ? 'Este módulo está pendiente de activación en la base de datos. Los demás módulos siguen disponibles.' : error.message || 'No fue posible completar la operación.';
const tieneAcceso = tipo => permiteFuncion(tienda,configuracion[tipo]?.funcion) &&
  (tipo==='SEDE' ? tienda.sesion.es_propietario : tienda.sesion.es_propietario || tienda.sesion.permisos?.clientes_gestionar);

async function cargar(tipo=modulo) {
  modulo=tipo; registros=[]; const solicitud=++version;
  $('growthContent').hidden=true; $('growthNotice').textContent='Consultando…';
  document.querySelectorAll('[data-modulo]').forEach(b=>b.classList.toggle('active',b.dataset.modulo===tipo));
  if (!tieneAcceso(tipo)) { $('growthNotice').textContent='Tu plan o tus permisos no incluyen este módulo. Consulta Mi plan o comunícate con TAMAKU.'; return; }
  try {
    let datos;
    if (tipo==='SEDE') {
      const resultado=await supabase.rpc('listar_sedes_tamaku',{p_tienda:tienda.id});
      if (resultado.error) throw resultado.error; datos=resultado.data;
    } else {
      datos=await readAllPages(()=>supabase.from('tamaku_comercial').select('*')
        .eq('id_tienda',tienda.id).eq('tipo',tipo).eq('archivado',$('growthArchived').checked)
        .order('created_at',{ascending:false}).order('id'));
    }
    if (solicitud!==version) return;
    registros=datos||[]; $('growthContent').hidden=false; $('growthNotice').textContent='';
    $('growthTitle').textContent=configuracion[tipo].titulo; $('growthDescription').textContent=configuracion[tipo].descripcion;
    $('growthNew').textContent=tipo==='SEDE'?'Crear sede':'Nuevo registro';
    $('growthArchived').parentElement.hidden=tipo==='SEDE'; pintar();
  } catch (error) { if(solicitud===version) $('growthNotice').textContent=errorTexto(error); }
}

function pintar() {
  const filtro=$('growthSearch').value.trim().toLowerCase();
  const lista=registros.filter(r=>[r.titulo,r.nombre,r.contacto,r.notas,r.etapa].join(' ').toLowerCase().includes(filtro));
  const pendientes=registros.filter(r=>!['GANADA','PERDIDA','COMPLETADA'].includes(r.etapa));
  $('growthKpis').innerHTML=modulo==='SEDE'?`<span>${registros.length} sedes</span>`:
    `<span>${registros.length} registros</span><span>${pendientes.length} pendientes</span><span>${dinero.format(registros.reduce((s,r)=>s+Number(r.valor),0))} ${modulo==='CAMPANA'?'presupuestado':'registrado'}</span>`;
  $('growthList').innerHTML=lista.map(r=>modulo==='SEDE' ?
    `<article class="growth-record"><small>${r.principal?'PRINCIPAL':'SEDE'}</small><h3>${escapar(r.nombre)}</h3><p>${escapar(r.direccion)}<br>${escapar(r.telefono)}</p><button data-sede="${escapar(r.id)}" ${r.id===tienda.id?'disabled':''}>${r.id===tienda.id?'Sede actual':'Entrar a esta sede'}</button></article>` :
    `<article class="growth-record"><small>${escapar(r.etapa.replaceAll('_',' '))}</small><h3>${escapar(r.titulo)}</h3><p>${escapar(r.contacto)}${r.proxima_accion?` · Próxima acción: ${escapar(r.proxima_accion)}`:''}</p><strong>${dinero.format(r.valor)}</strong><p>${escapar(r.notas)}</p><div class="growth-actions"><button data-editar="${r.id}">Editar</button><button data-archivar="${r.id}">${r.archivado?'Restaurar':'Archivar'}</button>${r.telefono&&r.consentimiento?`<a target="_blank" rel="noopener noreferrer" href="https://wa.me/${encodeURIComponent(r.telefono)}?text=${encodeURIComponent(r.notas||r.titulo)}">Abrir WhatsApp</a>`:''}</div></article>`
  ).join('')||'<p>No hay registros con este filtro.</p>';
}

function abrir(registro) {
  formulario.reset(); campo('id').value=registro?.id||''; $('growthFormError').textContent='';
  const esSede=modulo==='SEDE';
  document.querySelector('[data-campos="comercial"]').hidden=esSede;
  document.querySelector('[data-campos="sede"]').hidden=!esSede;
  // Los controles ocultos no participan en la validación nativa del formulario.
  for(const grupo of document.querySelectorAll('[data-campos]')) {
    grupo.querySelectorAll('input,select,textarea').forEach(c=>c.disabled=grupo.hidden);
  }
  campo('titulo').maxLength=esSede?100:120;
  campo('etapa').innerHTML=fases(modulo).map(f=>`<option value="${f}">${f.replaceAll('_',' ')}</option>`).join('');
  if(registro) for(const [clave,valor] of Object.entries(registro)) {
    const input=campo(clave); if(!input)continue;
    if(input.type==='checkbox')input.checked=valor===true;else input.value=valor??'';
  }
  $('growthFormTitle').textContent=esSede?'Crear sede':registro?'Editar registro':'Nuevo registro';
  $('growthDialog').showModal();
}

formulario.addEventListener('submit',async event=>{
  event.preventDefault(); if(!tieneAcceso(modulo))return;
  const tipo=modulo, boton=$('growthSave'); boton.disabled=true; $('growthFormError').textContent='';
  try {
    let resultado;
    if(tipo==='SEDE') resultado=await supabase.rpc('crear_sede_tamaku',{
      p_tienda:tienda.id,p_nombre:campo('titulo').value.trim(),p_direccion:campo('direccion').value.trim(),p_telefono:campo('telefono_sede').value.trim(),
    });
    else {
      const datos={titulo:campo('titulo').value.trim(),contacto:campo('contacto').value.trim(),telefono:campo('telefono').value.trim(),
        consentimiento:campo('consentimiento').checked,etapa:campo('etapa').value,valor:Number(campo('valor').value||0),
        proxima_accion:campo('proxima_accion').value||null,notas:campo('notas').value.trim()};
      resultado=campo('id').value ? await supabase.from('tamaku_comercial').update(datos).eq('id',campo('id').value).eq('id_tienda',tienda.id).eq('tipo',tipo).select('id').single()
        : await supabase.from('tamaku_comercial').insert({...datos,id_tienda:tienda.id,tipo}).select('id').single();
    }
    if(resultado.error)throw resultado.error;
    if(!resultado.data)throw new Error('No se pudo confirmar el guardado.');
    $('growthDialog').close();await cargar(tipo);window.TamakuUI?.notify('Registro guardado.');
  } catch(error) { $('growthFormError').textContent=errorTexto(error); }
  finally {boton.disabled=false;}
});
$('growthList').addEventListener('click',async event=>{
  const editar=event.target.closest('[data-editar]'),archivar=event.target.closest('[data-archivar]'),sede=event.target.closest('[data-sede]');
  if(editar)return abrir(registros.find(r=>r.id===editar.dataset.editar));
  if(sede){sede.disabled=true;try{await cambiarSede(sede.dataset.sede);}catch(error){sede.disabled=false;window.TamakuUI?.notify(error.message,'error');}return;}
  if(!archivar)return;
  const registro=registros.find(r=>r.id===archivar.dataset.archivar); if(!registro)return;
  archivar.disabled=true;
  const resultado=await supabase.from('tamaku_comercial').update({archivado:!registro.archivado})
    .eq('id',registro.id).eq('id_tienda',tienda.id).eq('tipo',modulo).select('id').single();
  if(resultado.error){archivar.disabled=false;window.TamakuUI?.notify(errorTexto(resultado.error),'error');return;}
  await cargar();
});
$('growthClose').onclick=()=>$('growthDialog').close();$('growthNew').onclick=()=>abrir();
$('growthSearch').oninput=pintar;$('growthArchived').onchange=()=>cargar();
document.querySelectorAll('[data-modulo]').forEach(b=>b.onclick=()=>{history.replaceState(null,'',`#${b.dataset.modulo}`);cargar(b.dataset.modulo);});
async function iniciar(){
  tienda=await window.tamakuContextReady;if(!tienda)return;
  $('growthPlan').textContent=`${nombrePlan(tienda.suscripcion?.plan_efectivo||tienda.suscripcion?.plan)}${tienda.suscripcion?.estado==='PRUEBA'?' · Prueba gratuita':''} · ${tienda.nombre}`;
  document.querySelectorAll('[data-modulo]').forEach(b=>b.hidden=!tieneAcceso(b.dataset.modulo));
  const solicitado=location.hash.slice(1),primero=Object.keys(configuracion).find(tieneAcceso);
  if(!primero){$('growthNotice').textContent='Estos módulos están incluidos en Zafiro y Diamante. Consulta Mi plan para ver tu suscripción.';return;}
  await cargar(configuracion[solicitado]&&tieneAcceso(solicitado)?solicitado:primero);
}
iniciar().catch(error=>$('growthNotice').textContent=errorTexto(error));
