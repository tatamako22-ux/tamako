import { nombrePlan } from './planes.js';
export function tiempoPrueba(fin, ahora = Date.now()) {
  const total = Math.max(0, Math.floor((new Date(fin).getTime() - ahora) / 1000));
  if (!Number.isFinite(total)) return null;
  return { dias: Math.floor(total/86400), horas: Math.floor(total%86400/3600), minutos: Math.floor(total%3600/60), segundos: total%60, total };
}
export function mostrarContadorPrueba(tienda) {
  const s=tienda?.suscripcion;
  if (!tienda?.sesion?.es_propietario || s?.estado !== 'PRUEBA' || !tiempoPrueba(s.vence) || document.getElementById('trialCountdown')) return;
  const css=document.createElement('link'); css.rel='stylesheet'; css.href=new URL('../../css/prueba-contador.css',import.meta.url).href; document.head.appendChild(css);
  const chip=document.createElement('button'); chip.type='button'; chip.className='trial-chip'; chip.setAttribute('aria-label','Ver tiempo restante de prueba');
  const dialog=document.createElement('dialog'); dialog.id='trialCountdown'; dialog.className='trial-dialog';
  dialog.innerHTML='<button class="trial-close" aria-label="Cerrar contador" type="button">×</button><span class="trial-eyebrow">TU NEGOCIO EMPIEZA AQUÍ</span><div class="trial-gem" aria-hidden="true">✦</div><h2>Tu prueba, tu plan</h2><p class="trial-plan"></p><p>Explora las funciones de tu plan durante estos 7 días.</p><div class="trial-clock" aria-label="Tiempo restante"></div><div class="trial-progress"><span></span></div><small>Sin cobros automáticos. Tus datos se conservan al vencer.</small><a href="mi-plan.html">Ver mi plan</a><button class="trial-continue" type="button">Seguir explorando</button>';
  dialog.querySelector('.trial-plan').textContent=nombrePlan(s.plan_efectivo || s.plan);
  document.body.append(chip,dialog);
  let foco;
  const abrir=()=>{foco=document.activeElement;if(!dialog.open)dialog.showModal();};
  const cerrar=()=>{dialog.close();foco?.focus?.();};
  chip.onclick=abrir;dialog.querySelector('.trial-close').onclick=cerrar;dialog.querySelector('.trial-continue').onclick=cerrar;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cerrar();}});
  function actualizar(){
    const t=tiempoPrueba(s.vence); if(!t)return;
    chip.textContent=t.total ? '✦ Prueba '+nombrePlan(s.plan_efectivo||s.plan)+' · '+t.dias+'d '+t.horas+'h' : 'Prueba finalizada · Ver plan';
    dialog.querySelector('.trial-clock').innerHTML=[['días',t.dias],['horas',t.horas],['min',t.minutos],['seg',t.segundos]].map(([label,value])=>'<div><strong>'+String(value).padStart(2,'0')+'</strong><span>'+label+'</span></div>').join('');
    dialog.querySelector('.trial-progress span').style.width=Math.min(100,t.total/(7*86400)*100)+'%';
  }
  actualizar(); const timer=setInterval(()=>{if(document.visibilityState==='visible')actualizar();},1000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  const key='tamaku-trial-seen:'+tienda.id+':'+s.vence+':'+new Date().toISOString().slice(0,10);
  try { if(!sessionStorage.getItem(key)){abrir();sessionStorage.setItem(key,'1');} } catch { abrir(); }
}
