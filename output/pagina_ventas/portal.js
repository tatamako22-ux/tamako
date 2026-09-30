'use strict';
const $ = id => document.getElementById(id);
// Inicializar el menú antes del resto de módulos.
const menuButton = $('menu-toggle');
const navigation = $('main-navigation');
const mobileQuery = window.matchMedia('(max-width: 900px)');
const menuBackdrop = document.createElement('button');
menuBackdrop.className = 'menu-backdrop';
menuBackdrop.type = 'button';
menuBackdrop.setAttribute('aria-label','Cerrar menú');
menuBackdrop.tabIndex = -1;
menuBackdrop.hidden = true;
document.body.append(menuBackdrop);
function setMenu(open, restoreFocus = false) {
  open = Boolean(open && mobileQuery.matches);
  navigation.classList.toggle('mobile-open',open);
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.textContent = open ? '✕ Cerrar' : '☰ Menú';
  menuBackdrop.hidden = !open;
  document.body.classList.toggle('menu-open',open);
  navigation.inert = mobileQuery.matches && !open;
  $('main-content').inert = open;
  $('open-consumo-modal').inert = open;
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
menuBackdrop.addEventListener('click', () => setMenu(false,true));
navigation.addEventListener('click',event => {
  if (event.target.closest('a[target="_blank"]')) setMenu(false,true);
});
mobileQuery.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown',event => {
  if (menuButton.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') {event.preventDefault(); setMenu(false,true);}
  if (event.key === 'Tab') {
    const items = [menuButton,...navigation.querySelectorAll('a[href],button')].filter(el => el.getClientRects().length);
    const first = items[0],last = items[items.length-1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
  }
});
setMenu(false);
const navItems = [...document.querySelectorAll('.sidebar-nav .nav-item')];
const groups = navItems.map(item => ({
  name: item.querySelector('.nav-link').textContent.trim(),
  icon: item.querySelector('svg'),
  links: [...item.querySelectorAll('.submenu a')].map(a => ({name:a.textContent.trim(),url:a.href})),
  direct: item.querySelector('.submenu') ? null : item.querySelector('.nav-link').href
}));
const modal = $('consumo-modal');
const dialog = modal.querySelector('.modal-content');
const detailView = document.createElement('div');
detailView.className = 'hidden-view';
dialog.append(detailView);
const views = [$('category-view'), $('estatal-clients-view'), $('privado-clients-view'), detailView];
let returnFocus;
function showView(view) {
  views.forEach(v => v.classList.toggle('hidden-view', v !== view));
  dialog.scrollTop = 0;
  if (!modal.classList.contains('hidden')) dialog.focus();
}
function openModal(view) {
  returnFocus = document.activeElement;
  showView(view);
  modal.classList.remove('hidden');
  document.querySelector('.page-container').inert = true;
  document.querySelector('.top-header').inert = true;
  $('open-consumo-modal').inert = true;
  document.body.style.overflow = 'hidden';
  $('close-consumo-modal').focus();
}
function closeModal() {
  modal.classList.add('hidden');
  document.querySelector('.page-container').inert = false;
  document.querySelector('.top-header').inert = false;
  $('open-consumo-modal').inert = false;
  document.body.style.overflow = '';
  returnFocus?.focus();
}
function externalLink(link) {
  const a = document.createElement('a');
  a.className = 'client-card'; a.textContent = link.name;
  a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function details(title, links, backToCategories = false) {
  detailView.replaceChildren();
  if (backToCategories) {
    const back = document.createElement('button');
    back.className = 'back-button retry-button'; back.textContent = '← Volver';
    back.addEventListener('click', () => showView($('category-view')));
    detailView.append(back);
  }
  const heading = document.createElement('h2'); heading.textContent = title;
  const list = document.createElement('div'); list.className = 'clients-container';
  links.forEach(link => list.append(externalLink(link)));
  detailView.append(heading,list);
  if (modal.classList.contains('hidden')) openModal(detailView); else showView(detailView);
}
navItems.forEach((item,index) => {
  const link = item.querySelector('.nav-link');
  const submenu = item.querySelector('.submenu');
  if (!submenu) return;
  submenu.id = 'submenu-' + index;
  link.setAttribute('role','button'); link.setAttribute('aria-controls',submenu.id);
  link.setAttribute('aria-expanded','false');
  function toggle(event) {
    event.preventDefault();
    const open = !item.classList.contains('active');
    navItems.forEach(i => {i.classList.remove('active'); if(i.querySelector('.submenu')) i.querySelector('.nav-link').setAttribute('aria-expanded','false');});
    item.classList.toggle('active',open); link.setAttribute('aria-expanded',String(open));
  }
  link.addEventListener('click',toggle);
  link.addEventListener('keydown',e => {if(e.key === ' ') toggle(e);});
});

$('open-consumo-modal').addEventListener('click',e => {e.preventDefault(); openModal($('category-view'));});
$('close-consumo-modal').addEventListener('click',closeModal);
modal.addEventListener('click',e => {if(e.target === modal) closeModal();});
document.addEventListener('keydown',e => {
  if(modal.classList.contains('hidden')) return;
  if(e.key === 'Escape') { e.preventDefault(); closeModal(); }
  if(e.key === 'Tab') {
    const focusables = [...dialog.querySelectorAll('a[href],button,[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusables[0], last = focusables[focusables.length-1];
    if(e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {e.preventDefault(); last.focus();}
    else if(!e.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {e.preventDefault(); first.focus();}
  }
});
document.querySelectorAll('.category-card').forEach(card => {
  card.tabIndex = 0; card.setAttribute('role','button');
  card.addEventListener('keydown',e => {if(e.key === 'Enter' || e.key === ' ') {e.preventDefault(); card.click();}});
});
$('show-estatales-btn').addEventListener('click',() => showView($('estatal-clients-view')));
$('show-privados-btn').addEventListener('click',() => showView($('privado-clients-view')));
$('show-eps-btn').addEventListener('click',() => {
  // No se inventan enlaces de consumo: se muestran los recursos EPS existentes.
  const eps = groups.filter(g => ['SANITAS','NUEVA EPS','MALLAMAS','CAPITAL SALUD'].includes(g.name));
  details('Recursos EPS',eps.flatMap(g => g.links.map(l => ({name:g.name + ' · ' + l.name,url:l.url}))),true);
});
const empty = document.createElement('p'); empty.className = 'empty-state';
empty.textContent = 'Aún no hay enlaces de clientes estatales configurados.';
$('estatal-clients-view').querySelector('.clients-container').append(empty);
['back-to-categories-estatal-btn','back-to-categories-privado-btn'].forEach(id => $(id).addEventListener('click',e => {e.preventDefault(); showView($('category-view'));}));

// Reconstruir únicamente formato permitido; nunca insertar HTML de la hoja directamente.
function safeContent(value) {
  const parsed = new DOMParser().parseFromString(String(value ?? ''),'text/html');
  const fragment = document.createDocumentFragment();
  const allowed = new Set(['B','STRONG','I','EM','U','BR','P','UL','OL','LI']);
  function copy(node,parent) {
    if(node.nodeType === 3) {parent.append(document.createTextNode(node.textContent)); return;}
    if(node.nodeType !== 1 || ['SCRIPT','STYLE','IFRAME','OBJECT','SVG','IMG'].includes(node.tagName)) return;
    let target = parent;
    if(allowed.has(node.tagName)) {target = document.createElement(node.tagName.toLowerCase()); parent.append(target);}
    else if(node.tagName === 'A') {
      try {
        const url = new URL(node.getAttribute('href'));
        if(['https:','http:'].includes(url.protocol)) {
          target = document.createElement('a'); target.href = url.href; target.target = '_blank'; target.rel = 'noopener noreferrer'; parent.append(target);
        }
      } catch (_) { /* El texto se conserva si el enlace no es válido. */ }
    }
    node.childNodes.forEach(child => copy(child,target));
  }
  parsed.body.childNodes.forEach(node => copy(node,fragment)); return fragment;
}
let intervalId, inFlight = false, loaded = false, lastMessages = '';
function status(message, retry = false) {
  const indicator = $('loading-indicator'); indicator.replaceChildren(document.createTextNode(message));
  indicator.hidden = !message;
  if(retry) {const button = document.createElement('button'); button.className = 'retry-button'; button.textContent = 'Reintentar'; button.addEventListener('click',cargarMensajes); indicator.append(button);}
}
function mostrarMensajes(messages) {
  inFlight = false;
  if(!Array.isArray(messages)) {mostrarError(); return;}
  const signature = JSON.stringify(messages);
  if (loaded && signature === lastMessages) {status(''); return;}
  lastMessages = signature;
  const container = $('comment-container'); container.replaceChildren();
  $('message-counter').textContent = messages.length + (messages.length === 1 ? ' comunicado' : ' comunicados');
  messages.forEach((message,index) => {
    const box = document.createElement('article'); box.className = 'message-box';
    box.style.animationDelay = Math.min(index * 65,390) + 'ms';
    const title = document.createElement('h3'); title.textContent = String(message?.title || 'Comunicado');
    const content = document.createElement('div'); content.className = 'message-text'; content.style.whiteSpace = 'pre-wrap'; content.style.overflowWrap = 'anywhere';
    content.append(safeContent(message?.content)); box.append(title,content); container.append(box);
  });
  if(!messages.length) {const p = document.createElement('p'); p.className = 'empty-state'; p.textContent = 'No hay comunicados para mostrar.'; container.append(p);}
  loaded = true; status('');
}
function mostrarError() {inFlight = false; status(loaded ? 'No se pudo actualizar. Se conservan los últimos comunicados.' : 'No se pudieron cargar los comunicados. Revisa tu conexión o acceso.',true);}
function cargarMensajes() {
  if(inFlight || document.hidden) return;
  if(!window.google?.script?.run) {status('Vista local: los comunicados estarán disponibles al abrir la aplicación en Google Apps Script.'); return;}
  inFlight = true; if(!loaded) status('Cargando comunicados…');
  try {google.script.run.withSuccessHandler(mostrarMensajes).withFailureHandler(mostrarError).getMensajes();} catch (_) {mostrarError();}
}
function iniciarActualizacion() {clearInterval(intervalId); cargarMensajes(); intervalId = setInterval(cargarMensajes,60000);}
document.addEventListener('visibilitychange',() => {if(document.hidden) clearInterval(intervalId); else iniciarActualizacion();});
iniciarActualizacion();
