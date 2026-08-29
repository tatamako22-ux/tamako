import { supabase } from "../config/supabaseClient.js";
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

document.addEventListener("DOMContentLoaded",async()=>{
  const tienda=await window.tamakuContextReady;
  if(!tienda?.id)return;
  const contenedor=document.getElementById("galeria-profesionales");
  const [prosRes,galsRes]=await Promise.all([
    supabase.from("profesionales").select("id_barbero,nombre_empleado,foto_url").eq("id_tienda",tienda.id).order("nombre_empleado"),
    supabase.from("galerias_profesionales").select("id,id_barbero,activa,galeria_profesional_imagenes(id)").eq("id_tienda",tienda.id)
  ]);
  if(prosRes.error){contenedor.innerHTML=`<div class="galeria-page-vacio error"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(prosRes.error.message)}</span></div>`;return}
  const galerias=galsRes.data||[],profesionales=prosRes.data||[];
  if(!profesionales.length){contenedor.innerHTML=`<div class="galeria-page-vacio"><i class="fa-solid fa-user-plus"></i><span>Primero registra un profesional.</span><a href="profesionales.html">Ir a Profesionales</a></div>`;return}
  contenedor.innerHTML=profesionales.map(p=>{const propias=galerias.filter(g=>g.id_barbero===p.id_barbero),fotos=propias.reduce((n,g)=>n+(g.galeria_profesional_imagenes?.length||0),0);return `<button type="button" class="galeria-profesional-card" data-id="${p.id_barbero}" data-nombre="${esc(p.nombre_empleado)}">${p.foto_url?`<img src="${esc(p.foto_url)}" alt="${esc(p.nombre_empleado)}" loading="lazy" decoding="async">`:`<span class="galeria-profesional-avatar"><i class="fa-solid fa-user"></i></span>`}<span class="galeria-profesional-copy"><small>PROFESIONAL</small><strong>${esc(p.nombre_empleado||"Sin nombre")}</strong><em>${propias.length} colecciones · ${fotos} fotos</em></span><span class="galeria-profesional-ir"><i class="fa-solid fa-images"></i> Administrar</span></button>`}).join("");
  contenedor.addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)window.TamakuGaleriaAdmin?.abrir(b.dataset.id,b.dataset.nombre)});
});
