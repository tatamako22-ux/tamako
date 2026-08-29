import { supabase } from "../config/supabaseClient.js";

const LIMITES = { colecciones: 6, porColeccion: 8, total: 48 };
let tienda, profesional, colecciones = [];
const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const modal = document.createElement("section");
modal.id = "galeria-profesional-modal";
modal.className = "galeria-admin-modal";
modal.setAttribute("aria-hidden", "true");
modal.innerHTML = `<div class="galeria-admin-backdrop" data-galeria-cerrar></div><article class="galeria-admin-panel" role="dialog" aria-modal="true" aria-labelledby="galeria-admin-titulo"><header><div><small>PORTAFOLIO PÚBLICO</small><h2 id="galeria-admin-titulo">Galería</h2><p id="galeria-admin-resumen"></p></div><button type="button" data-galeria-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button></header><form id="galeria-coleccion-form" class="galeria-coleccion-form"><input id="galeria-titulo" maxlength="60" required placeholder="Ej. Tinturas, uñas, cortes..."><input id="galeria-descripcion" maxlength="180" placeholder="Descripción breve (opcional)"><button type="submit"><i class="fa-solid fa-plus"></i> Crear colección</button></form><div id="galeria-admin-estado" class="galeria-admin-estado">Cargando galería…</div><div id="galeria-admin-lista" class="galeria-admin-lista"></div></article>`;
document.body.appendChild(modal);

const visor = document.createElement("div");
visor.className = "galeria-visor";
visor.setAttribute("aria-hidden", "true");
visor.innerHTML = `<button type="button" aria-label="Cerrar imagen"><i class="fa-solid fa-xmark"></i></button><img alt="Trabajo ampliado">`;
document.body.appendChild(visor);
function cerrarVisor(){visor.classList.remove("abierto");visor.setAttribute("aria-hidden","true")}
visor.addEventListener("click",cerrarVisor);

function sesionTienda() { try { return JSON.parse(localStorage.getItem("tamaku_tienda") || "null"); } catch { return null; } }
function estado(texto, error = false) { const n=document.getElementById("galeria-admin-estado"); n.textContent=texto; n.classList.toggle("error",error); n.hidden=!texto; }

async function comprimir(archivo) {
  if (!archivo.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  if (archivo.size > 5*1024*1024) throw new Error("La imagen original supera 5 MB.");
  const bitmap=await createImageBitmap(archivo), escala=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(bitmap.width*escala)); canvas.height=Math.max(1,Math.round(bitmap.height*escala));
  canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close?.();
  const blob=await new Promise(r=>canvas.toBlob(r,"image/webp",.82)); if(!blob) throw new Error("No fue posible procesar la imagen."); return blob;
}

async function cargar() {
  estado("Cargando galería…");
  const {data,error}=await supabase.from("galerias_profesionales").select("id,titulo,descripcion,orden,activa,galeria_profesional_imagenes(id,imagen_url,storage_path,titulo,orden)").eq("id_tienda",tienda.id).eq("id_barbero",profesional.id).order("orden");
  if(error) return estado(error.message,true); colecciones=data||[]; render();
}

function render() {
  const total=colecciones.reduce((n,c)=>n+(c.galeria_profesional_imagenes?.length||0),0);
  document.getElementById("galeria-admin-resumen").textContent=`${colecciones.length}/${LIMITES.colecciones} colecciones · ${total}/${LIMITES.total} imágenes`;
  document.getElementById("galeria-coleccion-form").hidden=colecciones.length>=LIMITES.colecciones;
  estado(colecciones.length?"":"Aún no hay colecciones. Crea la primera para mostrar tus trabajos.");
  document.getElementById("galeria-admin-lista").innerHTML=colecciones.map(c=>{const imgs=[...(c.galeria_profesional_imagenes||[])].sort((a,b)=>a.orden-b.orden), puede=imgs.length<LIMITES.porColeccion&&total<LIMITES.total; return `<section class="galeria-coleccion" data-coleccion="${c.id}"><div class="galeria-coleccion-cabecera"><div><h3>${esc(c.titulo)}</h3><p>${esc(c.descripcion||"Sin descripción")} · ${imgs.length}/${LIMITES.porColeccion}</p></div><div class="galeria-coleccion-acciones"><button data-accion="activar" title="${c.activa?"Ocultar del público":"Publicar"}"><i class="fa-solid fa-${c.activa?"eye":"eye-slash"}"></i></button><button data-accion="eliminar-coleccion" class="peligro" title="Eliminar"><i class="fa-solid fa-trash"></i></button></div></div><div class="galeria-imagenes">${imgs.map(i=>`<figure><img src="${esc(i.imagen_url)}" alt="${esc(i.titulo||c.titulo)}" loading="lazy" decoding="async"><button data-accion="eliminar-imagen" data-imagen="${i.id}" data-path="${esc(i.storage_path)}" aria-label="Eliminar imagen"><i class="fa-solid fa-xmark"></i></button></figure>`).join("")}</div>${puede?`<label class="galeria-subir"><i class="fa-solid fa-cloud-arrow-up"></i><span>Agregar fotos</span><small>WebP optimizado · máximo ${LIMITES.porColeccion}</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload="${c.id}"></label>`:`<p class="galeria-limite">Límite alcanzado</p>`}</section>`;}).join("");
}

async function abrir(id,nombre) { tienda=sesionTienda(); if(!tienda?.id) return window.TamakuUI?.error?.("No se encontró la tienda de esta sesión."); profesional={id,nombre}; document.getElementById("galeria-admin-titulo").textContent=`Trabajos de ${nombre}`; modal.classList.add("abierta"); modal.setAttribute("aria-hidden","false"); document.body.classList.add("galeria-sin-scroll"); await cargar(); }
function cerrar(){modal.classList.remove("abierta");modal.setAttribute("aria-hidden","true");document.body.classList.remove("galeria-sin-scroll")}
modal.querySelectorAll("[data-galeria-cerrar]").forEach(b=>b.addEventListener("click",cerrar));
document.addEventListener("click",e=>{const b=e.target.closest(".gallery-btn");if(b){e.preventDefault();e.stopPropagation();abrir(b.dataset.id,b.dataset.nombre||"Profesional")}});
modal.addEventListener("click",e=>{const img=e.target.closest(".galeria-imagenes img");if(!img)return;visor.querySelector("img").src=img.src;visor.querySelector("img").alt=img.alt;visor.classList.add("abierto");visor.setAttribute("aria-hidden","false")});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){cerrarVisor();cerrar()}});
window.TamakuGaleriaAdmin={abrir};

document.getElementById("galeria-coleccion-form").addEventListener("submit",async e=>{e.preventDefault();const titulo=document.getElementById("galeria-titulo").value.trim(),descripcion=document.getElementById("galeria-descripcion").value.trim();if(!titulo)return;estado("Creando colección…");const {error}=await supabase.from("galerias_profesionales").insert({id_tienda:tienda.id,id_barbero:profesional.id,titulo,descripcion:descripcion||null,orden:colecciones.length});if(error)return estado(error.message,true);e.target.reset();await cargar()});

modal.addEventListener("change",async e=>{const input=e.target.closest("[data-upload]");if(!input||!input.files.length)return;const col=colecciones.find(c=>c.id===input.dataset.upload),total=colecciones.reduce((n,c)=>n+(c.galeria_profesional_imagenes?.length||0),0),disponibles=Math.min(LIMITES.porColeccion-(col.galeria_profesional_imagenes?.length||0),LIMITES.total-total),archivos=[...input.files].slice(0,disponibles);estado(`Preparando ${archivos.length} imagen(es)…`);for(const archivo of archivos){let path="";try{const blob=await comprimir(archivo);path=`${tienda.id}/${profesional.id}/${col.id}/${crypto.randomUUID()}.webp`;const {error:ue}=await supabase.storage.from("galerias-profesionales").upload(path,blob,{contentType:"image/webp",upsert:false});if(ue)throw ue;const imagen_url=supabase.storage.from("galerias-profesionales").getPublicUrl(path).data.publicUrl;const {error:de}=await supabase.from("galeria_profesional_imagenes").insert({galeria_id:col.id,id_tienda:tienda.id,id_barbero:profesional.id,imagen_url,storage_path:path,titulo:archivo.name.replace(/\.[^.]+$/," ").trim().slice(0,80),orden:col.galeria_profesional_imagenes?.length||0});if(de)throw de}catch(error){if(path)await supabase.storage.from("galerias-profesionales").remove([path]);estado(error.message,true);return}}input.value="";await cargar()});

modal.addEventListener("click",async e=>{const b=e.target.closest("[data-accion]");if(!b)return;const col=colecciones.find(c=>c.id===b.closest("[data-coleccion]")?.dataset.coleccion);if(!col)return;b.disabled=true;if(b.dataset.accion==="activar")await supabase.from("galerias_profesionales").update({activa:!col.activa}).eq("id",col.id).eq("id_tienda",tienda.id);if(b.dataset.accion==="eliminar-imagen"){if(!confirm("¿Eliminar esta fotografía?")){b.disabled=false;return}const {error}=await supabase.from("galeria_profesional_imagenes").delete().eq("id",b.dataset.imagen).eq("id_tienda",tienda.id);if(!error&&b.dataset.path)await supabase.storage.from("galerias-profesionales").remove([b.dataset.path])}if(b.dataset.accion==="eliminar-coleccion"){if(!confirm(`¿Eliminar la colección “${col.titulo}” y todas sus fotos?`)){b.disabled=false;return}const paths=(col.galeria_profesional_imagenes||[]).map(i=>i.storage_path).filter(Boolean);const {error}=await supabase.from("galerias_profesionales").delete().eq("id",col.id).eq("id_tienda",tienda.id);if(!error&&paths.length)await supabase.storage.from("galerias-profesionales").remove(paths)}await cargar()});
